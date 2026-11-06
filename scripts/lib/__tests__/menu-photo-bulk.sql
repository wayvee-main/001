-- Isolated, rolled-back regression checks for the temporary bulk policy.
begin;
do $$
declare a jsonb;b jsonb;s jsonb;t uuid;t2 uuid;n integer;ids text[];
begin
 update regional_enrichment_settings set burst_until=now()+interval '1 day';
 delete from regional_enrichment_budgets;
 a:=begin_regional_enrichment(3000);
 perform begin_regional_enrichment(3000);perform begin_regional_enrichment(3000);perform begin_regional_enrichment(3000);
 b:=begin_regional_enrichment(3000);
 if (b->>'budget')::integer<>0 then raise exception 'Bulk hourly cap not shared';end if;
 perform finish_regional_enrichment((a->>'run_id')::uuid,3,10,'test','ok');
 b:=begin_regional_enrichment(3000);
 if (b->>'budget')::integer<>2997 then raise exception 'Bulk unused reservation not released';end if;
 perform finish_regional_enrichment((a->>'run_id')::uuid,3,10,'test','ok');
 b:=begin_regional_enrichment(3000);
 if (b->>'budget')::integer<>0 then raise exception 'Bulk repeated finish refunded twice';end if;
 update regional_enrichment_budgets set reserved=95999 where bucket like 'day:%';
 update regional_enrichment_budgets set reserved=0 where bucket like 'hour:%';
 b:=begin_regional_enrichment(3000);
 if (b->>'budget')::integer<>1 then raise exception 'Bulk daily cap not shared';end if;
 update regional_enrichment_settings set burst_until=now()-interval '1 minute';
 delete from regional_enrichment_budgets;
 b:=begin_regional_enrichment(3000);
 if (b->>'budget')::integer<>800 or b->>'mode'<>'maintenance' or (b->>'max_bytes')::integer<>60000000 then raise exception 'Burst did not expire to maintenance';end if;
 b:=begin_regional_enrichment(3000);
 if (b->>'budget')::integer<>0 then raise exception 'Expired burst bypassed normal hourly cap';end if;
 if has_function_privilege('anon','public.record_regional_photo_assets(text,text,uuid,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.claim_regional_enrichment_lane(text,integer)','EXECUTE')
  or has_table_privilege('anon','public.regional_photo_assets','SELECT') then raise exception 'Client access to collector internals';end if;

 insert into regional_places(id,name,category,lat,lon,city,website)
  select 'test:bulk:'||i,'Bulk venue '||i,'restaurant',37.8,-122.4,'oakland','https://venue.example/' from generate_series(1,24) i;
 insert into regional_enrichment_jobs(place_id,kind) select p.id,k.kind from regional_places p
  cross join(values('menu'),('photos')) k(kind) where p.id like 'test:bulk:%';
 create temporary table menu_lane on commit drop as select * from claim_regional_enrichment_lane('menu',12);
 if (select count(*) from menu_lane)<>12 or exists(select from menu_lane where kind<>'menu') then raise exception 'Menu lane incorrect';end if;
 select array_agg(place_id) into ids from menu_lane;
 create temporary table photo_lane on commit drop as select * from claim_regional_enrichment_lane('photos',12);
 if (select count(*) from photo_lane)<>12 or exists(select from photo_lane where kind<>'photos' or place_id=any(ids)) then raise exception 'Photo lane overlapped sibling leases';end if;

 delete from regional_enrichment_jobs;
 t:=gen_random_uuid();t2:=gen_random_uuid();
 insert into regional_enrichment_jobs(place_id,kind,status,lease_token,leased_until)
  values('test:bulk:1','photos','working',t,now()+interval '15 minutes'),('test:bulk:2','photos','working',t2,now()+interval '15 minutes');
 n:=record_regional_photo_assets('test:bulk:1','photos',t,jsonb_build_array(
  jsonb_build_object('sha256',repeat('a',64),'url','https://venue.example/food.jpg','width',600,'height',400,'byte_size',1000,'source_url','https://venue.example/menu'),
  jsonb_build_object('sha256',repeat('a',64),'url','https://venue.example/duplicate.jpg','width',600,'height',400,'byte_size',1000,'source_url','https://venue.example/menu')));
 perform record_regional_photo_assets('test:bulk:2','photos',t2,jsonb_build_array(
  jsonb_build_object('sha256',repeat('a',64),'url','https://venue.example/food.jpg','width',600,'height',400,'byte_size',1000,'source_url','https://venue.example/menu')));
 if (select count(*) from regional_photo_assets)<>1 or (select count(*) from regional_place_photos)<>2 then raise exception 'File hash deduplication failed';end if;
 begin
  perform record_regional_photo_assets('test:bulk:1','photos',gen_random_uuid(),'[]');
  raise exception 'Stale photo lease was accepted';
 exception when raise_exception then
  if sqlerrm<>'Photo inventory lease expired' then raise;end if;
 end;
 perform complete_regional_enrichment('test:bulk:1','photos',t,'ready',now()+interval '7 days');
 insert into regional_enrichment_jobs(place_id,kind,status,lease_token,leased_until)
  values('test:bulk:1','menu','working',t,now()+interval '15 minutes');
 if record_regional_menu_coverage('test:bulk:1',gen_random_uuid(),'{"status":"source_complete"}') then raise exception 'Stale menu coverage lease accepted';end if;
 if not record_regional_menu_coverage('test:bulk:1',t,'{"status":"source_complete","scope":"discovered_published_sources"}') then raise exception 'Active menu coverage rejected';end if;
 perform complete_regional_enrichment('test:bulk:1','menu',t,'ready',now()+interval '7 days');
 update regional_places set detail_content='{"photos":[{"url":"https://venue.example/one.jpg"},{"url":"https://venue.example/two.jpg"}],"menu":{"items":[{"image":"https://venue.example/two.jpg"}]},"menuDocuments":[{"url":"https://venue.example/menu.pdf"}]}' where id='test:bulk:1';
 update regional_places set detail_content='{"menu":{"items":[{"name":"Soup"},{"name":"Salad"}]}}' where id='test:bulk:2';
 s:=regional_enrichment_summary();
 if (s#>>'{images,verified_unique_files}')::integer<>1 or (s#>>'{images,venues_with_verified_images}')::integer<>2
  or (s#>>'{images,catalog_unique_photo_urls}')::integer<>2 or (s#>>'{images,remaining}')::integer<>9999 then raise exception 'Image summary counted jobs or duplicate URLs';end if;
 if (s#>>'{menus,with_items}')::integer<>2 or (s#>>'{menus,items}')::integer<>3
  or (s#>>'{menus,source_complete}')::integer<>1 or (s#>>'{menus,with_documents}')::integer<>1 then raise exception 'Menu coverage summary incorrect';end if;
end $$;
rollback;

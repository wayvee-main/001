import { imageForPlace } from '@/lib/place-images';

describe('verified place photos',()=>{
  it('keeps live catalog photos ahead of the local enrichment',()=>{
    expect(imageForPlace({id:'osm:1629071719',image:'https://venue.example/new-photo.jpg'})).toBe('https://venue.example/new-photo.jpg');
  });
  it('restores the three nearest venue photos when live/cache fields are null or empty',()=>{
    for(const id of ['osm:1629071719','osm:1186413846','osm:1186413904']){
      expect(imageForPlace({id,image:null})).toMatch(/^https:\/\//);
      expect(imageForPlace({id,image:'  '})).toBe(imageForPlace({id}));
    }
  });
  it('does not borrow a photo for a different branch or city',()=>{
    expect(imageForPlace({id:'osm:other-highwire-branch',image:null})).toBeUndefined();
    expect(imageForPlace({id:'san-francisco-place',image:null})).toBeUndefined();
  });
});

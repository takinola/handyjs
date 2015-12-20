/*
 * Test suite for content file of handy.js
 */

var expect = require('expect.js')
  , handy = require('../lib/handy')
  ;
  
  
describe('Content.js test suite', function(){
  it('Check if Content methods publish and unpublish work', function(done){
    var story = new handy.content.Story();
    expect(story.get('published')).to.be(true);
    story.unpublish();
    expect(story.get('published')).to.be(false);
    story.publish();
    expect(story.get('published')).to.be(true);
    done();
  });
  
  it('Check if Content method rate works', function(done){
    var tip = new handy.content.Tip();
    var ratings = {
      pass: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      fail: ['a', 11, 100, -5]
    };
    
    ratings.pass.forEach(function(val, key){
      tip.rate(val);
      expect(tip.get('rating')).to.be(val);
    });
    
    ratings.fail.forEach(function(val, key){
      tip.rate(val);
      expect(tip.get('rating')).not.to.be(val);
    });
    
    done();
  });

});

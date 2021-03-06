var request = require('supertest')
  , mongoose = require('mongoose')
  , config = require('mapcache-config')
  , async = require('async')
  , turf = require('turf')
  , fs = require('fs-extra')
  , colors = require('colors')
  // this initializes the mongo models
  , models = require('mapcache-models') // jshint ignore:line
  , TokenModel = mongoose.model('Token')
  , sinon = require('sinon')
  , Map = require('../../api/source')
  , Cache = require('../../api/cache')
  , app = require('../../express');

require('sinon-mongoose');
// require('chai').should();

function startTest(test) {
  console.log('Starting: '.white.bgRed.italic + test.white.bgBlue.bold);
}

function endTest(test) {
  console.log('Complete: '.white.bgRed.italic + test.white.bgBlue.bold);
}

function beforeTest(test) {
  console.log('Before: '.white.bgRed.italic + test.white.bgBlue.bold);
}

function afterTest(test) {
  console.log('After: '.white.bgRed.italic + test.white.bgBlue.bold);
}

describe("Cache Route Tests", function() {

  var sandbox;
  before(function(done) {
    sandbox = sinon.sandbox.create();
    var mongodbConfig = config.server.mongodb;

    var mongoUri = "mongodb://" + mongodbConfig.host + "/" + mongodbConfig.db;
    mongoose.connect(mongoUri, {server: {poolSize: mongodbConfig.poolSize}}, function(err) {
      if (err) {
        console.log('Error connecting to mongo database, please make sure mongodb is running...');
        throw err;
      }
      done();
    });
    mongoose.set('debug', true);
  });

  after(function(done) {
    mongoose.disconnect(function() {
      done();
    });
  });

  var userId = mongoose.Types.ObjectId();

  before(function() {
    var token = {
      _id: '1',
      token: '12345',
      userId: {
        populate: function(field, callback) {
          callback(null, {
            _id: userId,
            username: 'test',
            roleId: {
              permissions: ['CREATE_CACHE', 'READ_CACHE', 'DELETE_CACHE', 'EXPORT_CACHE']
            }
          });
        }
      }
    };

    sandbox.mock(TokenModel)
      .expects('findOne')
      .atLeast(0)
      .withArgs({token: "12345"})
      .chain('populate')
      .atLeast(0)
      .chain('exec')
      .atLeast(0)
      .yields(null, token);
  });

  after(function() {
    sandbox.restore();
  });

  describe("cache create tests", function() {

    var cacheId;

    var mapId;
    var map;

    beforeEach(function(done) {
      request(app)
        .post('/api/maps')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect('Content-Type', /json/)
        .send({
          dataSources: [{
            zOrder: 0,
            url: 'http://osm.geointservices.io/osm_tiles',
            format: 'xyz',
            valid: true,
            name: 'http://osm.geointservices.io/osm_tiles'
          }],
          name: 'OSM' }
        )
        .expect(function(res) {
          map = res.body;
          mapId = map.id;
        })
        .end(done);
    });

    afterEach(function(done) {
      if (!mapId) return done();
      Map.getById(mapId, function(err, map) {
        var m = new Map(map);
        m.delete(function() {
          if (!cacheId) return done();
          Cache.getById(cacheId, function(err, cache) {
            var c = new Cache(cache);
            c.delete(done);
          });
        });
      });
    });

    it("api should fail to create a cache because geometry is not specified", function(done) {
      startTest("api should fail to create a cache because geometry is not specified");
      request(app)
        .post('/api/caches')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 12345')
        .expect(400)
        .send({
          sourceId: mapId,
          minZoom: 0,
          maxZoom: 3,
          name: 'Cache'
        })
        .expect(function(res) {
        })
        .end(done);
    });

    it("api should create a cache", function(done) {
      startTest("api should create a cache");
      request(app)
        .post('/api/caches')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect('Content-Type', /json/)
        .send({
          sourceId: mapId,
          minZoom: 0,
          maxZoom: 1,
          name: 'Cache',
          geometry: turf.bboxPolygon([-180, -85, 180, 85]).geometry
        })
        .expect(function(res) {
          var cache = res.body;
          cacheId = cache.id;
          cache.should.have.property('id');
          cache.should.have.property('userId', userId.toString());
          cache.should.have.property('name', 'Cache');
          cache.should.have.property('minZoom', 0);
          cache.should.have.property('maxZoom', 1);
          cache.should.have.property('status');
        })
        .end(done);
    });

    it("api should create a cache and generate a format", function(done) {
      startTest("api should create a cache and generate a format");
      this.timeout(10000);
      request(app)
        .post('/api/caches')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect('Content-Type', /json/)
        .send({
          sourceId: mapId,
          minZoom: 0,
          maxZoom: 1,
          name: 'Cache',
          create: ['xyz'],
          geometry: turf.bboxPolygon([-180, -85, 180, 85]).geometry
        })
        .expect(function(res) {
          var cache = res.body;
          cacheId = cache.id;
          cache.should.have.property('id');
          cache.should.have.property('name', 'Cache');
          cache.should.have.property('minZoom', 0);
          cache.should.have.property('maxZoom', 1);
          cache.should.have.property('status');
        })
        .end(function() {
          var finishedGenerating = false;
          console.log('until');
          async.until(
            function() { return finishedGenerating; },
            function(callback) {
              request(app)
                .get('/api/caches/'+cacheId)
                .set('Authorization', 'Bearer 12345')
                .expect(200)
                .expect(function(res) {
                  var cache = res.body;
                  if (!cache.status.complete) return;
                  cache.formats.should.have.property('xyz');
                  if (cache.formats.xyz.complete) {
                    cache.formats.xyz.should.have.property('generatedTiles', 5);
                    finishedGenerating = true;
                  }
                }).end(function() {
                  setTimeout(callback, 500);
                });
            },
            function() {
              done();
            }
          );
        });
    });
});

  describe("tests on existing cache", function() {
    var mapId;
    var map;
    var cacheId;

    before(function(done) {
      request(app)
        .post('/api/maps')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect('Content-Type', /json/)
        .send({
          dataSources: [{
            zOrder: 0,
            url: 'http://osm.geointservices.io/osm_tiles',
            format: 'xyz',
            valid: true,
            name: 'http://osm.geointservices.io/osm_tiles'
          }],
          name: 'OSM' }
        )
        .expect(function(res) {
          map = res.body;
          mapId = map.id;
        })
        .end(function() {
          request(app)
            .post('/api/caches')
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer 12345')
            .expect(200)
            .expect('Content-Type', /json/)
            .send({
              sourceId: mapId,
              minZoom: 0,
              maxZoom: 1,
              name: 'Cache',
              geometry: turf.bboxPolygon([-180, -85, 180, 85]).geometry
            })
            .expect(function(res) {
              var cache = res.body;
              cacheId = cache.id;
              cache.should.have.property('id');
              cache.should.have.property('name', 'Cache');
              cache.should.have.property('minZoom', 0);
              cache.should.have.property('maxZoom', 1);
              cache.should.have.property('status');
            })
            .end(done);
        });
    });

    after(function(done) {
      if (!mapId) return done();
      Map.getById(mapId, function(err, map) {
        var m = new Map(map);
        m.delete(function() {
          if (!cacheId) return done();
          Cache.getById(cacheId, function(err, cache) {
            var c = new Cache(cache);
            c.delete(done);
          });
        });
      });
    });

    it ('should get all caches for the map', function(done) {
      startTest('should get all caches for the map');
      request(app)
        .get('/api/maps/'+mapId+'/caches')
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect(function(res) {
          console.log('res', res.body);
          var caches = res.body;
          console.log("caches", caches);
          caches.length.should.be.equal(1);
          var cache = caches[0];
          cache.should.have.property('id', cacheId);
          cache.should.have.property('name', 'Cache');
          cache.should.have.property('minZoom', 0);
          cache.should.have.property('maxZoom', 1);
          cache.should.have.property('status');
        })
        .end(done);
    });

    it ('should pull the cache', function(done) {
      startTest('should pull the cache');
      request(app)
        .get('/api/caches/'+cacheId)
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect(function(res) {
          console.log('res', res.body);
          var cache = res.body;
          cacheId = cache.id;
          cache.should.have.property('id', cacheId);
          cache.should.have.property('name', 'Cache');
          cache.should.have.property('minZoom', 0);
          cache.should.have.property('maxZoom', 1);
          cache.should.have.property('status');
        })
        .end(done);
    });

    it ('should pull the 0/0/0 tile for the cache', function(done) {
      startTest('should pull the 0/0/0 tile for the cache');
      var file = fs.createWriteStream('/tmp/cache_test.png');
      file.on('close', done);
      request(app)
        .get('/api/caches/'+cacheId+'/0/0/0.png')
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect(function(res) {
          console.log('response body is', res);
        })
        .pipe(file);
    });

    it ('should generate an xyz cache', function(done) {
      startTest('should generate an xyz cache');
      this.timeout(10000);
      request(app)
        .get('/api/caches/'+cacheId + '/generate')
        .set('Authorization', 'Bearer 12345')
        .query({format: 'xyz'})
        .expect(202)
        .expect(function(res) {
          var cache = res.body;
          cache.should.have.property('id', cacheId);
          cache.should.have.property('name', 'Cache');
          cache.should.have.property('minZoom', 0);
          cache.should.have.property('maxZoom', 1);
          cache.should.have.property('status');
          cache.status.should.have.property('xyz');
        }).end(function() {
          var finishedGenerating = false;
          console.log('until');
          async.until(
            function() { return finishedGenerating; },
            function(callback) {
              request(app)
                .get('/api/caches/'+cacheId)
                .set('Authorization', 'Bearer 12345')
                .expect(200)
                .expect(function(res) {
                  var cache = res.body;
                  cache.formats.should.have.property('xyz');
                  if (cache.formats.xyz.complete) {
                    cache.formats.xyz.should.have.property('generatedTiles', 5);
                    finishedGenerating = true;
                  }
                }).end(function() {
                  setTimeout(callback, 500);
                });
            },
            function() {
              done();
            }
          );
        });
    });

    it ('should generate a geopackage cache', function(done) {
      startTest('should generate a geopackage cache');
      this.timeout(10000);
      request(app)
        .get('/api/caches/'+cacheId + '/generate')
        .set('Authorization', 'Bearer 12345')
        .query({format: 'geopackage'})
        .expect(202)
        .expect(function(res) {
          var cache = res.body;
          cache.should.have.property('id', cacheId);
          cache.should.have.property('name', 'Cache');
          cache.should.have.property('minZoom', 0);
          cache.should.have.property('maxZoom', 1);
          cache.should.have.property('status');
          cache.formats.should.have.property('xyz');
        }).end(function() {
          var finishedGenerating = false;
          console.log('until');
          async.until(
            function() { return finishedGenerating; },
            function(callback) {
              request(app)
                .get('/api/caches/'+cacheId)
                .set('Authorization', 'Bearer 12345')
                .expect(200)
                .expect(function(res) {
                  var cache = res.body;
                  cache.formats.should.have.property('geopackage');
                  console.log('GeoPackage', cache.formats.geopackage.percentComplete);
                  if (cache.formats.geopackage.complete) {
                    cache.formats.geopackage.should.have.property('complete');
                    finishedGenerating = true;
                  }
                }).end(function() {
                  setTimeout(callback, 500);
                });
            },
            function() {
              done();
            }
          );
        });
    });

    it('should pull the overview tile', function(done) {
      startTest('should pull the overview tile');
      var file = fs.createWriteStream('/tmp/cache_overview_tile_test.png');
      file.on('close', done);
      request(app)
        .get('/api/caches/'+cacheId+'/overviewTile')
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect(function(res) {
        })
        .pipe(file);
    });

    it('should pull the 0/0/0 tile', function(done) {
      startTest('should pull the 0/0/0 tile');
      var file = fs.createWriteStream('/tmp/cache_zero_tile_test.png');
      file.on('close', done);
      request(app)
        .get('/api/caches/'+cacheId+'/0/0/0.png')
        .set('Authorization', 'Bearer 12345')
        .expect(200)
        .expect(function(res) {
        })
        .pipe(file);
    });

    it('should generate an xyz cache and download it', function(done) {
      startTest('should generate an xyz cache and download it');
      this.timeout(15000);
      request(app)
        .get('/api/caches/'+cacheId + '/xyz')
        .set('Authorization', 'Bearer 12345')
        .expect(202)
        .expect(function(res) {
          var cache = res.body;
          cache.should.have.property('id', cacheId);
          cache.should.have.property('name', 'Cache');
          cache.should.have.property('minZoom', 0);
          cache.should.have.property('maxZoom', 3);
          cache.should.have.property('status');
          cache.status.should.have.property('xyz');
        }).end(function() {
          var finishedGenerating = false;
          console.log('until');
          async.until(
            function() { return finishedGenerating; },
            function(callback) {
              request(app)
                .get('/api/caches/'+cacheId)
                .set('Authorization', 'Bearer 12345')
                .expect(200)
                .expect(function(res) {
                  var cache = res.body;
                  cache.formats.should.have.property('xyz');
                  if (cache.formats.xyz.complete) {
                    cache.formats.xyz.should.have.property('generatedTiles', 5);
                    finishedGenerating = true;
                  }
                }).end(function() {
                  setTimeout(callback, 500);
                });
            },
            function() {
              var file = fs.createWriteStream('/tmp/xyz_cache.zip');
              file.on('close', done);
              console.log('going to get xyz cache for %s', cacheId);
              request(app)
                .get('/api/caches/'+cacheId+'/xyz')
                .set('Authorization', 'Bearer 12345')
                .expect(200)
                .pipe(file);
            }
          );
        });
    });

    it('should delete the cache xyz format', function(done) {
      startTest('should delete the cache xyz format');
      request(app)
        .get('/api/caches/'+cacheId + '/generate')
        .set('Authorization', 'Bearer 12345')
        .query({format: 'xyz'})
        .expect(202)
        .expect(function(res) {
          var cache = res.body;
          cache.should.have.property('id', cacheId);
          cache.should.have.property('name', 'Cache');
          cache.should.have.property('minZoom', 0);
          cache.should.have.property('maxZoom', 1);
          cache.should.have.property('status');
          cache.status.should.have.property('xyz');
        }).end(function() {
          request(app)
            .delete('/api/caches/'+cacheId+'/xyz')
            .set('Authorization', 'Bearer 12345')
            .expect(200)
            .expect(function(res) {
            })
            .end(done);
        });
    });
  });
});

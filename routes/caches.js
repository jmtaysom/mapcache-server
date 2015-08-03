module.exports = function(app, auth) {
  var access = require('../access')
    , api = require('../api')
    , fs = require('fs-extra')
    , tileUtilities = require('../api/tileUtilities')
    , config = require('../config.json')
    , cacheXform = require('../transformers/cache');

  var passport = auth.authentication.passport
    , authenticationStrategy = auth.authentication.authenticationStrategy;

  app.all('/api/caches*', passport.authenticate(authenticationStrategy));

  var validateCache = function(req, res, next) {
    var cache = req.body;
    if (cache.id) {
      cache._id = cache.id;
    }
    req.newCache = cache;
    next();
  }

  var parseQueryParams = function(req, res, next) {
    var parameters = {};
    parameters.type = req.param('type');

    req.parameters = parameters;

    next();
  }

  app.get(
    '/api/caches/:cacheId/generate',
    access.authorize('EXPORT_CACHE'),
    function (req, res, next) {
    	var format = req.param('format');
    	console.log('create cache format ' + format + ' for cache ' + req.cache.name);
      var cache = req.cache;
      req.cache.minZoom = req.param('minZoom') || req.cache.minZoom;
      req.cache.maxZoom = req.param('maxZoom') || req.cache.maxZoom;
      new api.Cache().create(req.cache, format, function(err, newCache) {
        if (!err) {
          return res.sendStatus(202);
        }
        next(err);
      });
  	}
  );

  // get all caches
  app.get(
    '/api/caches',
    access.authorize('READ_CACHE'),
    parseQueryParams,
    function (req, res, next) {
      var options = {

      };

      new api.Cache().getAll(options, function(err, caches) {
        if (err) return next(err);

        var caches = cacheXform.transform(caches);
        res.json(caches);
      });

    }
  );

  // create a new cache
  app.post(
    '/api/caches',
    access.authorize('CREATE_CACHE'),
    validateCache,
    function(req, res, next) {

      new api.Cache().create(req.newCache, function(err, newCache) {
        if (err) return res.status(400).send(err.message);

        if (!newCache) return res.status(400).send();

        var response = cacheXform.transform(newCache);
        res.location(newCache._id.toString()).json(response);
      });
    }
  );

  // restart cache download
  app.get(
    '/api/caches/:cacheId/restart',
    access.authorize('CREATE_CACHE'),
    function(req, res, next) {

      new api.Cache().restart(req.cache, req.param('format'), function(err, newCache) {
        if (err) return res.status(400).send(err.message);

        if (!newCache) return res.status(400).send();

        var response = cacheXform.transform(newCache);
        res.location(newCache._id.toString()).json(response);
      });
    }
  );

  app.get(
    '/api/caches/:cacheId/:z/:x/:y.:format',
    access.authorize('READ_CACHE'),
    parseQueryParams,
    function (req, res, next) {
      new api.Cache().getTile(req.cache, req.param('format'), req.param('z'), req.param('x'), req.param('y'), function(err, tileStream) {
        if (err) return next(err);
        if (!tileStream) return res.status(404).send();

        tileStream.pipe(res);
      });
    }
  );

  app.get(
    '/api/caches/:cacheId/overviewTile',
    access.authorize('READ_CACHE'),
    parseQueryParams,
    function (req, res, next) {
      tileUtilities.getOverviewTile(req.cache, function(err, tileStream) {
        if (err) return next(err);
        if (!tileStream) return res.status(404).send();

        tileStream.pipe(res);
      });
    }
  );

  app.get(
  	'/api/caches/:cacheId/:format',
  	access.authorize('EXPORT_CACHE'),
  	function (req, res, next) {
    	var id = req.params.cacheId;
    	var minZoom = parseInt(req.param('minZoom'));
    	var maxZoom = parseInt(req.param('maxZoom'));
    	var format = req.param('format');
    	console.log('export zoom ' + minZoom + " to " + maxZoom + " in format " + format);
      new api.Cache().getData(req.cache, format, minZoom, maxZoom, function(err, status) {
        if (err) {
          return res.send(400, err);
        }
        if (status.creating) {
          return res.sendStatus(202);
        }
        if (status.stream) {
          res.attachment(req.cache.name + '_' + format + status.extension);
          status.stream.pipe(res);
        }
      })
  	}
  );

  // get cache
  app.get(
    '/api/caches/:cacheId',
    access.authorize('READ_CACHE'),
    parseQueryParams,
    function (req, res, next) {
      var cacheJson = cacheXform.transform(req.cache);
      res.json(cacheJson);
    }
  );

  // Delete a specific cache format
  app.delete(
    '/api/caches/:cacheId/:format',
    passport.authenticate(authenticationStrategy),
    access.authorize('DELETE_CACHE'),
    function(req, res, next) {
      new api.Cache().deleteFormat(req.cache, req.param('format'), function(err) {
        if (err) return next(err);
        res.status(200);
        res.json(req.cache);
      });
    }
  );

  // Delete a specific cache
  app.delete(
    '/api/caches/:cacheId',
    passport.authenticate(authenticationStrategy),
    access.authorize('DELETE_CACHE'),
    function(req, res, next) {
      new api.Cache().delete(req.cache, function(err) {
        if (err) return next(err);
        res.status(200);
        res.json(req.cache);
      });
    }
  );

}

var CacheModel = require('../../models/cache')
  , SourceModel = require('../../models/source')
  // , PNG = require('png-stream')
  // , JPG = require('jpg-stream')
  , request = require('request');

exports.process = function(source, callback) {
  callback(null, source);
  var child = require('child_process').fork('api/sources/processor.js');
  child.send({operation:'process', sourceId: source.id});
}

exports.getTile = function(source, format, z, x, y, params, callback) {
  console.log('get tile ' + z + '/' + x + '/' + y + '.' + format + ' for source ' + source.name);
  var url = source.url + "/" + z + '/' + x + '/' + y + '.png';
  var req = request.get({url: url,
    headers: {'Content-Type': 'image/png'},
  })
  .on('error', function(err) {
    console.log(err+ url);

    callback(err, tileInfo);
  })
  .on('response', function(response) {
    var size = response.headers['content-length'];
    SourceModel.updateSourceAverageSize(source, size, function(err) {
    });
  });

  // var returnStream = req;
  // // if (format == 'jpg' || format == 'jpeg') {
  //
  // var pngStream = req.pipe(new PNG.Decoder);
  // // console.log('png stream', pngStream);
  //
  // pngStream.on('error', function(err) {
  //   console.log('png stream error', err);
  // });
  //
  //
  //
  //
  //   returnStream = pngStream
  //     .pipe(new JPG.Encoder(256, 256, {quality: 100}));
  // // }
  //
  // returnStream.on('error', function(err) {
  //   console.log('return stream error', err);
  // });
  //
  //
  // callback(null, returnStream);
  callback(null, req);
}

exports.getData = function(source, callback) {
  callback(null);
}

exports.processSource = function(source, callback) {
  console.log("xyz");
  source.status.message = "Complete";
  source.status.complete = true;
  source.save(function(err) {
    callback(err);
  });
}

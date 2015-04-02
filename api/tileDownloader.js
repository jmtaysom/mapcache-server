var request = require('request');
var fs = require('fs-extra');
var config = require('../config.json');

exports.download = function(tileInfo, callback) {
	var filepath = getFilepath(tileInfo);
	var dir = createDir(tileInfo.cache._id, filepath);
	var filename = getFilename(tileInfo, 'xyz');

	if (!fs.existsSync(filepath + '/' + filename)) {
    var url;

    console.log('downloading: '+ tileInfo.cache.source.url + '/' + filepath + filename + " to " + dir  + filename);


		var stream = fs.createWriteStream(dir + '/' + filename);
		stream.on('close',function(status){
			callback(null, tileInfo)
		});

    request.get({url: tileInfo.cache.source.url + '/' + filepath  + filename,
		    headers: {'Content-Type': 'image/png'},
	    })
		  .on('error', function(err) {
		    console.log(err+ tileInfo.cache.source.url + '/' + filepath + filename);

			  callback(err, tileInfo);
		  })
		  .pipe(stream);
	} else {
    console.log('tile already exists', tileInfo);
    callback(null, tileInfo);
  }
}

function getFilepath(tileInfo) {
	return tileInfo.z + '/' + tileInfo.x + '/' ;
}

function getFilename(tileInfo, type) {
	if (type == 'tms') {
		y = Math.pow(2,tileInfo.z) - tileInfo.y -1;
		return y + '.png';
	} else {
		return tileInfo.y + '.png';
  }
}

function createDir(cacheName, filepath){
	if (!fs.existsSync(config.server.cacheDirectory.path + '/' + cacheName +'/'+ filepath)) {
    fs.mkdirsSync(config.server.cacheDirectory.path + '/' + cacheName +'/'+ filepath, function(err){
       if (err) console.log(err);
     });
	}
  return config.server.cacheDirectory.path + '/' + cacheName +'/'+ filepath;
}

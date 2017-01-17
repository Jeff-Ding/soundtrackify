// Load future from fibers
var Future = Npm.require("fibers/future");
// Load exec
var exec = Npm.require("child_process").exec;

Meteor.methods({
  searchMovie: function (query) {
    this.unblock();
    var future = new Future();

    // call searchMovie python program to query movie database
    var command = '/Users/Jeff/Documents/Projects/soundtrackify/IMDb/searchMovie "' + query + '"';

    exec(command, function(err, stdout, stderr) {
      if (err) {
        console.log(err);
        throw new Meteor.Error(500, command + "failed");
      }

      // parse program output into list of alternating titles and movieIDs
      var result = stdout.split("\n");
      result.pop();

      // list of matched movie objects
      var resultObj = [];
      
      // index into resultObj
      var index = 0;

      // convert list of titles and movieIDs strings into list of pair objects
      for (var i in result) {
        var mod = i % 3;
        var value = result[i];

        if (mod === 0) {
          resultObj.push({
            movieID: null,
            title: null,
            year: null,
            director: null});

          resultObj[index].movieID = value;
        } else if (mod === 1){
          resultObj[index].title = value;
        } else if (mod === 2){
          resultObj[index].year = value;
          index++;
        }
      }

      future.return(resultObj);
    });

    return future.wait();
  },

  findSoundtrack: function(movieID) {
  },

  checkSpotify: function (songs) {
    // API access
    var spotifyAPI = new SpotifyWebApi();

    var soundtrack = songs.map(function (song) {
      var songURI = onSpotify(spotifyAPI, song);
      var ret = {
        title: song.title,
        performer: song.performer ? song.performer : "Unknown",
        writer: song.writer ? song.writer : "Unknown",
        found: songURI,
        checked: Boolean(songURI)
      };

      return ret;
    });


    return soundtrack;

  },

  createPlaylist: function (name, URIlist) {
    var spotifyAPI = new SpotifyWebApi();

    // initialize playlist
    var result = spotifyAPI.createPlaylist(
      Meteor.user().services.spotify.id, name, {public: false}
    );

    // token needs to be refreshed, try again
    if (checkTokenRefreshed(result, spotifyAPI)) {
      result = spotifyAPI.createPlaylist(
        Meteor.user().services.spotify.id, name, {public: false}
      );
    }

    // add tracks from URIs to create playlist
    spotifyAPI.addTracksToPlaylist(
      Meteor.user().services.spotify.id, result.data.body.id, URIlist, {}
    );

    // return playlist URL
    return result.data.body.external_urls.spotify;
  }

});

// parse raw text tracks info into array object
function parseTracks(text) {
  // turn into list of invididual tracks
  var stripped = text.replace(/["]+/g, '');
  var textList = stripped.split('\\\\').slice(1, -1);

  // return array of objects
  var soundtrack = [];

  for (var i in textList) {
    // seperate fields of each track
    var trackInfo = textList[i].split("\\");
    var numTracks = trackInfo.length;

    // initialize track object with title
    var track = {};
    track.title = trackInfo[0].trim();

    // parse rest of fields
    for (var j = 1; j < numTracks; j++) {
      if (trackInfo[j].match(/.*Performed .*by /) !== null) {
        var performer = trackInfo[j].replace(/.*Performed .*by /, '');

        var perfAKA = trackInfo[j].match(/\(as ([^)]*)\)/);
        if (perfAKA !== null) {
          performer = perfAKA[1];
        }

        track.performer = performer.replace(/ \([^)]*\)/, '');
      } else if (trackInfo[j].match(/.*Written .*by /) !== null) {
        var writer = trackInfo[j].replace(/.*Written .*by /, '');

        var writeAKA = trackInfo[j].match(/\(as ([^)]*)\)/);
        if (writeAKA !== null) {
          writer = writeAKA[1];
        }

        track.writer = writer.replace(/ \([^)]*\)/, '');
      }
    }

    soundtrack.push(track);
  }

  return soundtrack;
}

function checkTokenRefreshed(response, api) {
  if (response.error && response.error.statusCode === 401) {
    api.refreshAndUpdateAccessToken();
    return true;
  } else {
    return false;
  }
}

function onSpotify(spotifyAPI, song) {
    var query = song.title + (song.performer ?
                              ' ' + song.performer : song.writer ?
                                song.writer : '');
    var result = spotifyAPI.searchTracks(query, {limit: 1});

    // token needs to be refreshed, try again
    if (checkTokenRefreshed(result, spotifyAPI)) {
      result = spotifyAPI.searchTracks(query, {limit: 1});
    }

    if (result.data.body.tracks.items[0]) {  // found
      return result.data.body.tracks.items[0].uri;
    } else {  // not found
      return false;
    }
 }

function 

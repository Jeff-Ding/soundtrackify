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

      // parse program output into repeating list of movieID, title, and year strings
      var result = stdout.split("\n");
      result.pop();

      // list of movie objects
      var resultObj = [];
      
      // index into resultObj
      var index = 0;

      // convert list of strings into list of objects
      for (var i in result) {
        var mod = i % 3;
        var value = result[i];

        if (mod === 0) {
          resultObj.push({
            movieID: null,
            title: null,
            year: null});

          resultObj[index].movieID = value;
        } else if (mod === 1){
	  // remove text between brackets avoid lengthy titles
          resultObj[index].title = value.replace(/ \([^)]*\)/, '');
        } else if (mod === 2){
          resultObj[index].year = value;
          index++;
        }
      }

      future.return(resultObj);
    });

    return future.wait();
  },

  getSoundtrack: function (movieID) {
    var future = new Future();

    // call getSoundtrack python program to query movie database
    var command = '/Users/Jeff/Documents/Projects/soundtrackify/IMDb/getSoundtrack "' + movieID + '"';

    exec(command, function(err, stdout, stderr) {
      if (err) {
        console.log(err);
        throw new Meteor.Error(500, command + "failed");
      }

      // parse program output into repeating list of title, performer, and writer strings
      var result = stdout.split("\n");
      result.pop();

      // list of track objects
      var resultObj = [];
      
      // index into resultObj
      var index = 0;

      // convert list of strings into list of objects
      for (var i in result) {
        var mod = i % 3;
        var value = result[i];

        if (mod === 0) {
          resultObj.push({
            title: null,
            performer: null,
            writer: null});

	  // remove text between brackets 
          resultObj[index].title = value.replace(/ \([^)]*\)/, '');
        } else if (mod === 1){
	  if (value) { // parse nonempty string
	    stageName = value.match(/\(as ([^)]*)\)/); // may appear as "Real Name (as Stage Name)
	    if (stageName) { // exists
	      // remove text between brackets 
	      resultObj[index].performer = stageName[1].replace(/ \([^)]*\)/, '');
	    } else {
	      // remove text between brackets 
	      resultObj[index].performer = value.replace(/ \([^)]*\)/, '');
	    }
	  }
        } else if (mod === 2){
	  if (value) { // parse nonempty string
	    stageName = value.match(/\(as ([^)]*)\)/); // may appear as "Real Name (as Stage Name)
	    if (stageName) { // exists
	      // remove text between brackets 
	      resultObj[index].writer = stageName[1].replace(/ \([^)]*\)/, '');
	    } else {
	      // remove text between brackets 
	      resultObj[index].writer = value.replace(/ \([^)]*\)/, '');
	    }
	  }

          index++;
        }
      }

      future.return(resultObj);
    });

    return future.wait();
  },

  // given a list of track objects, checks of each can be found on Spotify
  // returns new list soundtrack with original information and found status
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


// checks of song can be found on Spotify
function onSpotify(spotifyAPI, song) {
    // start with performer, fall back to writer
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

// checks if Spotify API token needs refreshed
function checkTokenRefreshed(response, api) {
  if (response.error && response.error.statusCode === 401) {
    api.refreshAndUpdateAccessToken();
    return true;
  } else {
    return false;
  }
}

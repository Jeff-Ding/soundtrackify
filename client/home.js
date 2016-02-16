Template.home.rendered = function () {
  // initializes all typeahead instances
  Meteor.typeahead.inject();
};

Template.home.helpers({
  searchMovie: function (query, sync, callback) {
    Meteor.call("searchMovie", query, function (err, result) {
      if (err) {
        console.log(err);
        return;
      }
      callback(result);
    });
  },

  selected: function (event, suggestion, datasetName) {
    var movie = JSON.parse(JSON.stringify(suggestion));
    Session.set("soundtrack", parseTracks(movie.soundtrack));
    Session.set("title", movie.title);
    Router.go("playlist");
  }
});

// parse raw text tracks info into array object
function parseTracks(text) {
  // turn into list of invididual tracks
  var stripped = text.replace(/['"]+/g, '');
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

  console.log(soundtrack);
  return soundtrack;
}

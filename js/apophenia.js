/*
 * Apophenia Prototype!
 * brez!
 */

/*jslint indent: 2, newcap: true, browser: true */

(function () {
  "use strict";
  var context,
    bass = [
      {name: 'bass1', url: '/audio/blaze.mp3'},
      {name: 'bass2', url: '/audio/spaceman.mp3'},
      {name: 'bass3', url: '/audio/swagga.mp3'},
      {name: 'bass4', url: '/audio/colors.mp3'}
    ],
    audioEventNode,
    analyser,
    canvasContext,
    DEBUG = false,
    E = 60,
    GRIDWIDTH = 7,
    GRIDHEIGHT = 4,
    T = 100;

  var random = function () {
    return Math.floor((Math.random()*255)+1);
  };

  function init() {
    if (typeof AudioContext !== "undefined") {
      context = new AudioContext();
    } else if (typeof webkitAudioContext !== "undefined") {
      context = new webkitAudioContext();
    } else {
      alert("Use Chrome sucka!");
    }
  }

  function reshuffle(array) {
    var shuffle = new Uint8Array(array.length),
        j = 126,
        k = 0;
    for ( var i = 127; i < 255; i++ ) {
      shuffle[k] = array[i];
      k++;
      shuffle[k] = array[j]
      k++;
      j--;
    }
    return shuffle;
  }

  function colors(value) {
    var blood = "00",
        crip = "00",
        red = "FF";
    if ( value > T ) {
      crip = value.toString(16);
      if ( crip.length < 2 ) {
        crip = "0"+crip;
      }
    } else {
      blood = value.toString(16);
      if ( blood.length < 2 ) {
        blood = "0"+blood;
      }
    }
    red = (((blood/2)*crip)%255).toString(16);
    if ( red.length < 2 ) {
      red = "0"+red;
    }
    return "#"+red+blood+crip;
  }

  function initAnimation() {
    canvasContext = $("#canvas").get()[0].getContext("2d");
    if ( DEBUG ) {
      var grid = new Grid();
      grid.full();
      return;
    }
    analyser = context.createAnalyser();
    analyser.smoothingTimeConstant = 0.2;
    analyser.fftSize = 512;
    audioEventNode = context.createJavaScriptNode(2048, 1, 1);
    audioEventNode.connect(context.destination);
    audioEventNode.onaudioprocess = function() {
      /* if (parseInt(context.currentTime % 3) == 2) {
        return;
      }*/
      var array =  new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      var shuffledArray = array;
      canvasContext.clearRect(0, 0, 1200, 650);
      var count = 0;
      for ( var i = 1; i <= GRIDWIDTH; i++) {
        for ( var j = 1; j <= GRIDHEIGHT; j++ ) {
          (new Attack(60+(i*60),60*j)).trigger(shuffledArray[count*9]);
          (new Attack((60+(i*60+E)),(60*j)+E)).trigger(shuffledArray[count*9+1]);
          (new Release((60+E)+(i*60),60*j)).trigger(shuffledArray[count*9+2]);
          (new Release((60)+(i*60),(60*j)+E)).trigger(shuffledArray[count*9+3]);
          count++;
        }
      }
    }
  }

  //Edge is a single line in the Grid
  var Edge = function Edge() {};

  Edge.prototype = {
    trigger: function trigger(color) {
      canvasContext.beginPath();
      canvasContext.moveTo(this.fromVertex.x, this.fromVertex.y);
      canvasContext.lineTo(this.toVertex.x, this.toVertex.y);
      canvasContext.lineWidth = 10;
      canvasContext.strokeStyle = colors(color);
      canvasContext.stroke();
    }
  };

  //Forward slanting Edge
  var Attack = function Attack(x,y) {
    this.fromVertex = { 'x': x, 'y': y + E };
    this.toVertex = { 'x': x + E, 'y': y };
    this.color = '#000000';
  };

  Attack.prototype = new Edge();

  //Backward slanting Edge
  var Release = function Release(x,y) {
    this.fromVertex = { 'x': x, 'y': y };
    this.toVertex = { 'x': x + E, 'y': y + E };
    this.color = '#000000';
  };

  Release.prototype = new Edge();

  //Grid represent the visual grid
  var Grid = function Grid() {
    this.attack = {};
    this.release = {};
  };

  Grid.prototype = {
    clear: function clear() {
      $.each( [this.attack, this.release], function(edge) {
        edge.clear();
      });
    },
    full: function full() {
      var count = 1;
      for ( var i = 1; i <= GRIDWIDTH; i++) {
        for ( var j = 1; j <= GRIDHEIGHT; j++ ) {
          canvasContext.fillText('('+i+','+j+')', (i*60), (j*60));
          canvasContext.fillText('('+count+')', (i*60+10), (j*60)+10);
          (new Attack(60+(i*60),60*j)).trigger();
          (new Attack((60+(i*60+E)),(60*j)+E)).trigger();
          (new Release((60+E)+(i*60),60*j)).trigger();;
          (new Release((60)+(i*60),(60*j)+E)).trigger();;
          count++;
        }
      }
    }
  };

  //Pad represents a single Apophenia on a Bank of sounds
  var Pad = function Pad(source) {
    this.source = source;
    this.playing = false;
  };

  Pad.prototype = {
    load: function load() {
      var request = new XMLHttpRequest();
      var source = this.source;
      request.open("GET", source.url, true);
      request.responseType = "arraybuffer";
      request.onload = function () {
        context.decodeAudioData(request.response, function (buffer) {
          source.buffer = buffer;
        }, function(err) { console.log("err(decodeAudioData): "+err); });
      };
      request.send();
    },
    play: function play() {
      var source = context.createBufferSource();
      source.buffer = this.source.buffer;
      source.connect(context.destination);
      source.connect(analyser);
      source.loop = true;
      source.noteOn(context.currentTime);
      this.buffer = source;
      this.source.playing = true;
    },
    stop: function stop() {
      this.buffer.noteOff(context.currentTime);
      this.source.playing = false;
    }
  };

  //Bank represents a bank of (currently) 3 pads
  var Bank = function Bank(bank) {
    var pads = {};
    $.each(bank, function (i, pad) {
      pad.source = new Pad(pad);
      pad.source.load();
      pads[pad.name] = pad;
    });
    this.pads = pads;
  };

  Bank.prototype = {
    toggle: function toggle(name, callback) {
      if (this.active) {
        this.active.source.stop();
        if (this.active.name == name) {
          this.active = undefined;
          callback();
          return;
        }
      }
      this.pads[name].source.play();
      this.active = this.pads[name];
    }
  };


  init();
  initAnimation();

  var bassBank = new Bank(bass);

  $('.bass-play').click(function () {
    $('.bass-pad').removeClass('bass-pad-on');
    $(this).addClass('bass-pad-on');
    bassBank.toggle($(this).attr('id'), function () {
      $('.bass-pad').removeClass('bass-pad-on');
    });
  });

}());

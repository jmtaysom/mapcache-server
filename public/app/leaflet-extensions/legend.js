var $ = require('jquery');
/*global L*/

(function (window, document, undefined) {


L.Control.Legend = L.Control.extend({
	options: {
		position: 'bottomright',
		enabled: true
	},

  styles: undefined,

  initialize: function(styles, options) {
    this.styles = styles.styles;
    L.Util.setOptions(this, options);
  },

	onAdd: function (map) {
    this._div = L.DomUtil.create('div', 'legend');
    this.update(map);
    return this._div;
  },

	showLegend: true,

  update: function (map) {
		$(this._div).empty();
		if (this.styles.length === 0) return;

    for (var i = 0; i < this.styles.length && this.showLegend; i++) {
			var style = this.styles[i].style;
			var el = $('<canvas height="30" width="32" style="zoom:50%; -moz-transform:scale(.5)"></canvas>');
			var canvas = el[0];
	    if (canvas.getContext){
	      var ctx = canvas.getContext('2d');
	      ctx.clearRect ( 0 , 0 , canvas.width, canvas.height );
	      var rgbFill = this.hexToRgb(style.fill);
	      ctx.fillStyle = "rgba("+rgbFill.r+","+rgbFill.g+","+rgbFill.b+","+style['fill-opacity']+")";
	      ctx.lineWidth = style['stroke-width'];
	      var rgbStroke = this.hexToRgb(style.stroke);
	      ctx.strokeStyle = "rgba("+rgbStroke.r+","+rgbStroke.g+","+rgbStroke.b+","+style['stroke-opacity']+")";

	      ctx.beginPath();
	      ctx.moveTo(10,0);
	      ctx.lineTo(30,10);
	      ctx.lineTo(32,20);
	      ctx.lineTo(15,30);
	      ctx.lineTo(18,18);
	      ctx.lineTo(0,12);
	      ctx.lineTo(10,0);
	      ctx.closePath();
	      ctx.fill();
	      ctx.stroke();

	    } else {
	      console.log('no canvas support');
	    }
			$(this._div).append(el);
			$(this._div).append('&nbsp;&nbsp;&nbsp;<span class="page-sub-entity-title top-padding-l">' + this.styles[i].key +' = ' + this.styles[i].value + '</span><br>');

    }
		var toggle = $('<a style="cursor: pointer;">'+(this.showLegend ? 'Hide Legend' : 'Show Legend') + '</a>');
		toggle.on('click', function() {
			this.showLegend = !this.showLegend;
			this.update(map);
		}.bind(this));
		$(this._div).append(toggle);
  },

	hexToRgb: function(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
  }
});

}(this, document));

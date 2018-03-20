/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var createRegl = require('regl');
var createMatrix = require('regl-scattermatrix');

var ScatterGl = require('../scattergl');
var AxisIDs = require('../../plots/cartesian/axis_ids');

var calcMarkerSize = require('../scatter/calc').calcMarkerSize;
var calcAxisExpansion = require('../scatter/calc').calcAxisExpansion;
var calcColorscales = require('../scatter/colorscale_calc');

var TOO_MANY_POINTS = 1e5;

function calc(gd, trace) {
    var stash = {};
    var opts = {};
    var i;

    var dimLength = trace.dimensions.length;
    var hasTooManyPoints = (dimLength * trace._commonLength) > TOO_MANY_POINTS;
    opts.data = new Array(dimLength);

    var markerOptions = {};

    for(i = 0; i < dimLength; i++) {
        var xa = AxisIDs.getFromId(gd, trace.xaxes[i]);
        var ya = AxisIDs.getFromId(gd, trace.yaxes[i]);

        // using xa or ya should make no difference here
        var vals = opts.data[i] = makeCalcdata(xa, trace, trace.dimensions[i]);

        // Re-use SVG scatter axis expansion routine except
        // for graph with very large number of points where it
        // performs poorly.
        // In big data case, fake Axes.expand outputs with data bounds,
        // and an average size for array marker.size inputs.
        var ppad;
        if(hasTooManyPoints) {
            ppad = 2 * (markerOptions.sizeAvg || Math.max(markerOptions.size, 3));
        } else if(markerOptions) {
            ppad = calcMarkerSize(trace, trace._length);
        }
        calcAxisExpansion(gd, trace, xa, ya, vals, vals, ppad);
    }

    // TODO
    // - marker / line options
    // - colorscale

    var scene = stash.scene = {};
    scene.scatterOpts = opts;

    scene.matrix = true;

    return [{x: false, y: false, t: stash, trace: trace}];
}

function makeCalcdata(ax, trace, dim) {
    var cdata = ax.makeCalcdata({
        v: dim.values,
        vcalendar: trace.calendar
    }, 'v');

    if(ax.type === 'log') {
        for(var i = 0; i < cdata.length; i++) {
            cdata[i] = ax.c2l(cdata[i]);
        }
    }

    return cdata;
}

function plot(gd, _, cdata) {
    if(!cdata.length) return;

    var fullLayout = gd._fullLayout;
    var gs = fullLayout._size;
    var scene = cdata[0][0].t.scene;
    var trace = cdata[0][0].trace;

    // make sure proper regl instances are created
    fullLayout._glcanvas.each(function(d) {
        if(d.regl || d.pick) return;
        d.regl = createRegl({
            canvas: this,
            attributes: {
                antialias: !d.pick,
                preserveDrawingBuffer: true
            },
            extensions: ['ANGLE_instanced_arrays', 'OES_element_index_uint'],
            pixelRatio: gd._context.plotGlPixelRatio || global.devicePixelRatio
        });
    });

    var regl = fullLayout._glcanvas.data()[0].regl;

    var opts = scene.scatterOpts;
    var dimLength = trace.dimensions.length;
    opts.ranges = new Array(dimLength);
    opts.domains = new Array(dimLength);

    for(var i = 0; i < dimLength; i++) {
        var xa = AxisIDs.getFromId(gd, trace.xaxes[i]);
        var ya = AxisIDs.getFromId(gd, trace.yaxes[i]);
        opts.ranges[i] = [xa.range[0], ya.range[0], xa.range[1], ya.range[1]];
        opts.domains[i] = [xa.domain[0], ya.domain[0], xa.domain[1], ya.domain[1]];
    }

    scene.scatterOpts.viewport = [0, 0, fullLayout.width, fullLayout.height];
    scene.scatterOpts.padding = [gs.l, gs.t, gs.r, gs.b];

    if(scene.matrix === true) {
        scene.matrix = createMatrix(regl);
    }
    if(scene.matrix) {
        scene.matrix.update(scene.scatterOpts);
        scene.matrix.draw();
    }
}

// TODO splom 'needs' the grid component, register it here?

module.exports = {
    moduleType: 'trace',
    name: 'splom',

    basePlotModule: require('./base_plot'),
    categories: ['gl', 'regl', 'cartesian', 'symbols', 'markerColorscale', 'showLegend', 'scatter-like'],

    attributes: require('./attributes'),
    supplyDefaults: require('./defaults'),

    calc: calc,
    plot: plot,
    hoverPoints: function() {},
    selectPoints: function() {},
    style: function() {},

    meta: {
        description: [
            'SPLOM !!!'
        ].join(' ')
    }
};

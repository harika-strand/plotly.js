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

var Lib = require('../../lib');
var AxisIDs = require('../../plots/cartesian/axis_ids');

var calcMarkerSize = require('../scatter/calc').calcMarkerSize;
var calcAxisExpansion = require('../scatter/calc').calcAxisExpansion;
var calcColorscales = require('../scatter/colorscale_calc');
var convertMarkerStyle = require('../scattergl/convert').convertMarkerStyle;

var BADNUM = require('../../constants/numerical').BADNUM;
var TOO_MANY_POINTS = require('../scattergl/constants').TOO_MANY_POINTS;

function calc(gd, trace) {
    var stash = {};
    var opts = {};
    var i, xa, ya;

    var dimLength = trace.dimensions.length;
    var hasTooManyPoints = (dimLength * trace._commonLength) > TOO_MANY_POINTS;
    var matrix = opts.data = new Array(dimLength);

    for(i = 0; i < dimLength; i++) {
        // using xa or ya should make no difference here
        xa = AxisIDs.getFromId(gd, trace.xaxes[i]);
        matrix[i] = makeCalcdata(xa, trace, trace.dimensions[i]);
    }

    calcColorscales(trace);
    Lib.extendFlat(opts, convertMarkerStyle(trace));

    for(i = 0; i < dimLength; i++) {
        xa = AxisIDs.getFromId(gd, trace.xaxes[i]);
        ya = AxisIDs.getFromId(gd, trace.yaxes[i]);

        // Re-use SVG scatter axis expansion routine except
        // for graph with very large number of points where it
        // performs poorly.
        // In big data case, fake Axes.expand outputs with data bounds,
        // and an average size for array marker.size inputs.
        var ppad;
        if(hasTooManyPoints) {
            ppad = 2 * (opts.sizeAvg || Math.max(opts.size, 3));
        } else {
            ppad = calcMarkerSize(trace, trace._commonLength);
        }
        calcAxisExpansion(gd, trace, xa, ya, matrix[i], matrix[i], ppad);
    }

    var scene = stash.scene = sceneUpdate(gd, stash);
    if(!scene.matrix) scene.matrix = true;
    scene.matrixOptions = opts;

    return [{x: false, y: false, t: stash, trace: trace}];
}

function makeCalcdata(ax, trace, dim) {
    var i;

    var cdata = ax.makeCalcdata({
        v: dim.values,
        vcalendar: trace.calendar
    }, 'v');

    for(i = 0; i < cdata.length; i++) {
        cdata[i] = cdata[i] === BADNUM ? NaN : cdata[i];
    }

    if(ax.type === 'log') {
        for(i = 0; i < cdata.length; i++) {
            cdata[i] = ax.c2l(cdata[i]);
        }
    }

    return cdata;
}

function sceneUpdate(gd, stash) {
    var scene = stash._scene;

    var reset = {
        dirty: true,
        opts: null
    };

    var first = {
        selectBatch: null,
        unselectBatch: null,
        // regl- component stubs, initialized in dirty plot call
        matrix: false,
        select: null
    };

    if(!scene) {
        scene = stash._scene = Lib.extendFlat({}, reset, first);

        scene.update = function update(opt) {
            if(scene.matrix) scene.matrix.update(opt);
            scene.draw();
        };

        scene.draw = function draw() {
            if(scene.matrix) scene.matrix.draw();

            // TODO selection stuff

            scene.dirty = false;
        };

        // make sure canvas is clear
        scene.clear = function clear() {
            // TODO
        };

        // remove selection
        scene.clearSelect = function clearSelect() {
            if(!scene.selectBatch) return;
            scene.selectBatch = null;
            scene.unselectBatch = null;
            scene.matrix.update(scene.opts);
            scene.clear();
            scene.draw();
        };

        // remove scene resources
        scene.destroy = function destroy() {
            if(scene.matrix) scene.matrix.destroy();

            scene.opts = null;
            scene.selectBatch = null;
            scene.unselectBatch = null;

            stash._scene = null;
        };
    }

    // In case if we have scene from the last calc - reset data
    if(!scene.dirty) {
        Lib.extendFlat(scene, reset);
    }

    return scene;

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

    var dimLength = trace.dimensions.length;
    var viewOpts = {
        ranges: new Array(dimLength),
        domains: new Array(dimLength)
    };

    for(var i = 0; i < dimLength; i++) {
        var xa = AxisIDs.getFromId(gd, trace.xaxes[i]);
        var ya = AxisIDs.getFromId(gd, trace.yaxes[i]);
        viewOpts.ranges[i] = [xa.range[0], ya.range[0], xa.range[1], ya.range[1]];
        viewOpts.domains[i] = [xa.domain[0], ya.domain[0], xa.domain[1], ya.domain[1]];
    }

    viewOpts.viewport = [0, 0, fullLayout.width, fullLayout.height];
    viewOpts.padding = [gs.l, gs.t, gs.r, gs.b];

    if(scene.matrix === true) {
        scene.matrix = createMatrix(regl);
    }
    if(scene.matrix) {
        scene.matrix.update(scene.matrixOptions);
    }

    scene.update(viewOpts);
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

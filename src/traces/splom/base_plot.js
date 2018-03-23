/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Registry = require('../../registry');
var getModuleCalcData = require('../../plots/get_data').getModuleCalcData;
var Cartesian = require('../../plots/cartesian');

var SPLOM = 'splom';

function plot(gd) {
    var fullLayout = gd._fullLayout;
    var _module = Registry.getModule(SPLOM);
    var splomCalcData = getModuleCalcData(gd.calcdata, _module);

    // clear gl frame, if any, since we preserve drawing buffer
    if(fullLayout._glcanvas && fullLayout._glcanvas.size()) {
        fullLayout._glcanvas.each(function(d) {
            if(d.regl) d.regl.clear({color: true});
        });
    }

    for(var i = 0; i < splomCalcData.length; i++) {
        _module.plot(gd, {}, splomCalcData);
    }

}

function clean(newFullData, newFullLayout, oldFullData, oldFullLayout) {
    // TODO clear regl-splom instances

    Cartesian.cleanSubplots(newFullData, newFullLayout, oldFullData, oldFullLayout);
}

module.exports = {
    name: SPLOM,
    attrRegex: Cartesian.attrRegex,
    layoutAttributes: Cartesian.layoutAttributes,
    supplyLayoutDefaults: Cartesian.supplyLayoutDefaults,
    drawFramework: Cartesian.drawFramework,
    plot: plot,
    clean: clean,
    toSVG: Cartesian.toSVG
};

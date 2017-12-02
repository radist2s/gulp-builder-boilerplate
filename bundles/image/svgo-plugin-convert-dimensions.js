'use strict';

exports.type = 'full';

exports.active = false;

exports.description = 'removes width and height in presence of viewBox';

/**
 * Convert width/height to viewBox. Remove width/height attributes when a viewBox attribute converted.
 *
 * @author Kirk Bentley / Fyrebase
 */
exports.fn = function(data) {

    var svg = data.content[0];

    if (!svg.isElem('svg')) {
        return data;
    }

    var width = svg.attr('width'),
        height = svg.attr('height')

    width = width ? width.value : 0
    height = height ? height.value : 0

    if (!width || !height) {
        return data
    }

    svg.addAttr({
        name: 'viewBox',
        value: '0 0 ' + width + ' ' + height,
        prefix: '',
        local: 'class'
    });

    svg.removeAttr('width');
    svg.removeAttr('height');

    return data;
};
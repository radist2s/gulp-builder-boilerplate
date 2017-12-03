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

    var item = data.content[0];

    if (!item.isElem('svg')) {
        return data;
    }
    else if (item.hasAttr('viewBox')) {
        return data;
    }

    var width = item.attr('width'),
        height = item.attr('height')

    width = width ? width.value : 0
    height = height ? height.value : 0

    if (!width || !height) {
        return data
    }

    item.addAttr({
        name: 'viewBox',
        value: '0 0 ' + width + ' ' + height,
        prefix: '',
        local: 'class'
    });

    item.removeAttr('width');
    item.removeAttr('height');

    return data;
};
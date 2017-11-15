var gutil = require('gulp-util');
var through = require('through2');

const uniqStr = '\00borschik\00';

const additionalFreezeExtsRe = /\.(?:css|js|swf)$/;

/**
 * RegExp to find href="1.css" | src="1.js"
 * @const
 * @type {RegExp}
 */
const allIncRe = /<!-->|<!--[^\[<][\s\S]*?-->|href="(.+?)"|src="(.+?)"|background="(.+?)"/g;

function HtmlLinksProcessor(html, urlMap) {
    this.urlMap = urlMap
    this.html = html

    return this
}

HtmlLinksProcessor.prototype = {
    process: function () {
        return this.processInclude(
            this.parseInclude(this.html)
        )
    },

    pathTo: function (path) {
        return this.urlMap && this.urlMap[path] || path
    },

    parseInclude: function(content) {

        var includes = [];
        var _this = this;

        var text = content instanceof Buffer ? content.toString('utf-8') : content;

        var texts = text
            .replace(allIncRe, function(_, includeHref, includeSrc, includeBackground) {
                if (includeHref) {
                    includes.push({
                        url: _this.pathTo(includeHref),
                        type: 'href'
                    });

                } else if (includeSrc) {
                    includes.push({
                        url: _this.pathTo(includeSrc),
                        type: 'src'
                    });

                } else if (includeBackground) {
                    includes.push({
                        url: _this.pathTo(includeBackground),
                        type: 'background'
                    });

                } else {
                    includes.push({
                        file: _,
                        type: 'comment'
                    });
                }

                return uniqStr;

            })
            .split(uniqStr);

        // zip texts and includes
        var res = [], t, i;
        while((t = texts.shift()) != null) {
            t && res.push(t);
            (i = includes.shift()) && res.push(i);
        }

        return res;

    },

    processInclude: function(content) {
        var parsed = content || this.content;

        for(var i = 0; i < parsed.length; i++) {
            var item = parsed[i];

            if (typeof item == 'string') {
                continue;
            }

            if (item.type == 'href' || item.type == 'src' || item.type == 'background') {
                // freeze images with cssBase.processLink
                parsed[i] = item.type + '="' + item.url + '"';

            } else {
                parsed[i] = item.file;
            }
        }

        return parsed.join('');
    }
};

HtmlLinksProcessor.prototype.constructor = HtmlLinksProcessor

module.exports = function (urlsMap) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            cb(null, file);
            return;
        }

        var htmlContent = file.contents

        try {
            file.contents = new Buffer(new HtmlLinksProcessor(htmlContent, urlsMap).process());

            this.push(file);
        } catch (err) {
            this.emit('error', new gutil.PluginError('gulp-<%= pluginName %>', err));
        }

        cb();
    });
};
var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var gutil = require('gulp-util')
var path = require('path')

var resolvePath = require('../lib').resolvePath
var bundleCaption = require('../lib').getBundleCaption(__dirname)

var packageConfig = require('./package').config || {}
var options = packageConfig.font || {}

var sourceDir = options.sourceDir ? resolvePath(options.sourceDir) : undefined
var outDir = options.outDir ? resolvePath(options.outDir) : undefined

const
    SOURCE_DIR_ARG = 'source-dir',
    SYMBOL_FONT_ARG = 'symbol'

gulp.task('font-convert', 'Convert fonts ' + bundleCaption,
    function (done) {
        var args = require('args-parser')(process.argv)

        if (args[SOURCE_DIR_ARG] !== true) {
            sourceDir = args[SOURCE_DIR_ARG]
        }

        var isSymbolFonts = args[SYMBOL_FONT_ARG]

        if (!sourceDir || !outDir) {
            throw new gutil.PluginError('font-convert', 'sourceDir or outDir are not specified properly')
        }

        var fontgen = require('fontconvert-tool')

        fontgen.log = gutil.log.bind(gutil)

        if (isSymbolFonts) {
            fontgen.defaultConfig.ttfautoHintArgs = ['--symbol'].concat(fontgen.defaultConfig.ttfautoHintArgs)
        }

        fontgen.convertFonts(sourceDir, path.resolve(outDir), done, {subset: options.subset})
    },
    {
        options: function () {
            var options = {}

            options[SOURCE_DIR_ARG + '= (optional)'] = 'Source fonts directory. Default: as in config'
            options[SYMBOL_FONT_ARG] = 'Source fonts directory contains symbol fonts. Use it on ttfautohint error.'

            return options
        }()
    }
)
var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var path = require('path')

var resolvePath = require('../lib').resolvePath
var bundleCaption = require('../lib').getBundleCaption(__dirname)

var packageConfig = require('./package').config || {}
var options = packageConfig.freezer || {}

// Freezing
var freezeOutDir = options.outDir ? resolvePath(options.outDir) : undefined
var freezeConfigFile

// CSS Freezer
var cssFiles = options.cssFiles ? resolvePath(options.cssFiles) : undefined
var cssFreezeMapBaseDir = options.cssFreezeMapBaseDir
var cssFreezeMapFilename = options.cssFreezeMapFilename

// JS Freezer
var jsFiles = options.jsFiles ? resolvePath(options.jsFiles) : undefined
var jsFreezeMapBaseDir = options.jsFreezeMapBaseDir
var jsFreezeMapFilename = options.jsFreezeMapFilename

var htmlFreezeFile = options.htmlFile ? resolvePath(options.htmlFile) : undefined

var freezeNestingLevel = options.freezeNestingLevel || 1

module.exports = function (freezeConfig) {
    freezeOutDir = freezeConfig.outDir || freezeOutDir
    cssFiles = freezeConfig.cssFiles || cssFiles
    jsFiles = freezeConfig.jsFiles || jsFiles
    cssFreezeMapBaseDir = freezeConfig.cssFreezeMapBaseDir || cssFreezeMapBaseDir
    jsFreezeMapBaseDir = freezeConfig.jsFreezeMapBaseDir || jsFreezeMapBaseDir
    htmlFreezeFile = freezeConfig.htmlFile || htmlFreezeFile
}

gulp.task('freeze-css', 'Freeze CSS files and relative resources ' + bundleCaption, options.cssTasksDependencies || [], function () {
    if (!cssFiles) {
        return
    }

    var gulpCssFreezer = require('gulp-css-freezer'),
        vfs = require('vinyl-fs'),
        gulpCleanCSS = require('gulp-clean-css')

    var stream = vfs.src(cssFiles)

    if (options.cssSelectorsRemove) {
        stream = stream.pipe(removeCssSelectors())
    }

    if (options.cssCleanUp) {
        stream = stream.pipe(
            gulpCleanCSS({
                compatibility: 'ie8',
                level: {1: {specialComments: false}}
            })
        )
    }

    return stream
        .pipe(gulpCssFreezer({
            freezeMapBaseDir: cssFreezeMapBaseDir,
            freezeNestingLevel: freezeNestingLevel,
            freezeMapFileName: cssFreezeMapFilename
        }))
        .pipe(vfs.dest(freezeOutDir, {overwrite: false}))
        .pipe(gulpCssFreezer.freezeMapResolve())
        .pipe(vfs.dest(freezeOutDir))
})

gulp.task('freeze-js', 'Freeze JS files ' + bundleCaption, options.jsTasksDependencies || [], function () {
    if (!jsFiles) {
        return
    }

    var gulpJsFreeze = require('gulp-js-freezer')
    var vfs = require('vinyl-fs')

    return vfs.src(jsFiles)
        .pipe(gulpJsFreeze({
            freezeMapBaseDir: jsFreezeMapBaseDir,
            freezeNestingLevel: freezeNestingLevel,
            freezeMapFileName: jsFreezeMapFilename
        }))
        .pipe(vfs.dest(freezeOutDir, {overwrite: false}))
        .pipe(gulpJsFreeze.freezeMapResolve())
        .pipe(vfs.dest(freezeOutDir))
})

gulp.task('freezer', 'Freeze CSS and JS files ' + bundleCaption, ['freeze-css', 'freeze-js'])

gulp.task('freeze-html', 'Freeze HTML file ' + bundleCaption, ['freezer'], function () {
    if (!htmlFreezeFile) {
        return
    }

    var htmlLinksProcessor = require('./libs/html-links-processor'),
        rename = require('gulp-rename'),
        extend = require('extend'),
        fs = require('fs')

    var renameIndexHtml = false

    if (fs.existsSync(freezeConfigFile)) {
        var freezeConfig = fs.readFileSync(freezeConfigFile)

        freezeConfig = freezeConfig ? JSON.parse(freezeConfig.toString('utf-8')) : ''

        renameIndexHtml = freezeConfig && freezeConfig['freeze-dev']
    }

    var cssFreezeMap = fs.readFileSync(path.join(freezeOutDir, cssFreezeMapFilename))
    cssFreezeMap = cssFreezeMap ? JSON.parse(cssFreezeMap.toString('utf-8')) : ''

    var jsFreezeMap = fs.readFileSync(path.join(freezeOutDir, jsFreezeMapFilename))
    jsFreezeMap = jsFreezeMap ? JSON.parse(jsFreezeMap.toString('utf-8')) : ''

    var replacePath = gulp.src(htmlFreezeFile)
        .pipe(htmlLinksProcessor({
            'static/js/app/loader.js' : 'static/js/app/loader-min.js'
        }))
        .pipe(htmlLinksProcessor(extend(cssFreezeMap, jsFreezeMap)))

    if (renameIndexHtml) {
        replacePath.pipe(rename({suffix: '-production'}))
    }

    replacePath.pipe(gulp.dest(path.dirname(htmlFreezeFile)))

    return replacePath
})

gulp.task('css-remove-selectors', 'Remove CSS selectors PostCSS task ' + bundleCaption, function (done) {
    var vfs = require('vinyl-fs')

    vfs.src(cssFiles)
        .pipe(removeCssSelectors())
        .pipe(vfs.dest(path.dirname(cssFiles), {overwrite: true}))
})

function removeCssSelectors() {
    var postcss = require('postcss'),
        postCssRemoveSelectors = require('postcss-remove-selectors'),
        through = require('through')

    return through(
        function (sourceFile) {
            var cssCode = sourceFile.contents.toString('utf-8')

            var removeRuleMatch = cssCode.match(/\bremoveSelectors\s*\(\s*([\s\S]+?)\s*\)/)

            try {
                var removeSelectors = removeRuleMatch ? eval(removeRuleMatch[1]) : null

                if (!removeSelectors) {
                    return this.queue(sourceFile)
                }
            }
            catch(e) {
                this.emit('error', removeRuleMatch ? 'Check syntax in matched remove selectors expression: ' + removeRuleMatch[1] : e)

                return this.queue(sourceFile)
            }

            if (!(removeSelectors instanceof Array)) {
                removeSelectors = [removeSelectors]
            }

            var reducedCss = postcss()
                .use(postCssRemoveSelectors({selectors: removeSelectors}))
                .process(cssCode)
                .css

            sourceFile.contents = new Buffer(reducedCss)

            this.queue(sourceFile)
        }
    )
}
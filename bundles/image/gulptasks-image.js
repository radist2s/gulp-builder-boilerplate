var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var path = require('path')
var defaults = require('lodash.defaults')
var runSequence = require('run-sequence')

var resolvePath = require('../lib').resolvePath
var bundleCaption = require('../lib').getBundleCaption(__dirname)

var spritesBuildTasks = []

var packageConfig = require('./package').config || {}

var rasterSpritesConf = defaults(
    packageConfig.rasterSprites || {},
    {
        chunksMask: '**/*.png',
        chunksMaskRetina: '**/*2x.png',
        cssBuildDir: '../../static/less/parts/sprites',
        imgBuildDir: '../../static/img/sprites-build', // eg: /sprite-one.png && /sprite-one-2x.png
        imgBuildDirCss: '../img/sprites-build', // eg: /sprite-one.png && /sprite-one-2x.png
        outFormat: 'less'
    }
)

var svgSpritesConf = packageConfig.svgSprites || {}


if (rasterSpritesConf && rasterSpritesConf.tasks && rasterSpritesConf.tasks.length) {
    rasterSpritesConf.tasks.forEach(function (task) {
        addSpritesBuildTask.apply(this, parseTaskAsArguments(task))
    })
}

gulp.task('build-sprites', 'Build raster sprites ' + bundleCaption, spritesBuildTasks, function () {
    // Alternatively you can create task directly by function not by config
    return runSequence(
        addSpritesBuildTask('../../static/img/sprites/desktop/nope', false, false, 'icon-', 'desktop')
    )
})

function createOptimizeSvgStream(svgSourceDir, additionalPlugins) {
    var imagemin = require('gulp-imagemin')
    var svgoMinifyIDs = require('svgo-plugin-unify-ids')

    var svgoPlugins = [
        {removeViewBox: false},
        {cleanupIDs: false},
        {unifyIDs: svgoMinifyIDs}
    ]

    if (additionalPlugins) {
        svgoPlugins = svgoPlugins.concat(additionalPlugins)
    }

    return gulp.src(path.join(path.resolve(svgSourceDir), '**/*.svg'))
        .pipe(imagemin([
            imagemin.svgo({plugins: svgoPlugins})
        ]))
        .pipe(gulp.dest(svgSourceDir))
}

gulp.task('svg-optim', 'Optimize SVG ' + bundleCaption, function () {
    return createOptimizeSvgStream(svgSpritesConf.sourceDir)
})

gulp.task('svg-combiner', 'Combine SVG sprites ' + bundleCaption, ['svg-optim'], function () {
    var svgSourceDir = resolvePath(svgSpritesConf.sourceDir)
    var svgBuildDir = resolvePath(svgSpritesConf.buildDir)

    var svgSprite = require('gulp-svg-sprites'),
        rename = require('gulp-rename')

    var outStyleFile = svgSpritesConf.outStyleFile,
        styleFileFormat = path.extname(outStyleFile).replace(/^\./, '')

    var styleFileExtName = styleFileFormat === 'css' ? 'css' : 'scss'

    var templates = styleFileFormat === 'less' ?  {
        css: false,
        scss: require('fs').readFileSync(resolvePath('svg-sprite-less.template', __dirname), 'utf-8')
    } : {}

    var outStyleFilePath = path.join(path.dirname(outStyleFile), path.basename(outStyleFile, '.' + styleFileFormat) + '.' + styleFileExtName)

    outStyleFilePath = path.relative(svgBuildDir, outStyleFilePath)

    return gulp.src(path.join(svgSourceDir, '**/*.svg'))
        .pipe(svgSprite({
            baseSize: 16,
            cssFile: outStyleFilePath,
            svgPath: svgSpritesConf.styleSvgPath,
            selector: svgSpritesConf.selector,
            padding: 5,
            templates: templates,
            svg: {
                // symbols: 'sprite-symbols.svg'
                sprite: svgSpritesConf.spriteFileName
            },
            // mode: 'symbols',
            preview: false
        }))
        .pipe(rename(function (path) {
            if (styleFileFormat === 'less' && path.extname === '.scss') {
                path.extname = '.less'
            }
        }))
        .pipe(gulp.dest(svgBuildDir))
})

/**
 * @param spritesPath
 * @param {*} png8b true|false|jpg-70
 * @param disableRetina
 * @param spriteNamePrefix
 * @param subDirectory
 * @returns {string}
 */
function addSpritesBuildTask(spritesPath, png8b, disableRetina, spriteNamePrefix, subDirectory) {
    var waiteForOptimizer = false

    var spriteName = path.basename(spritesPath),
        taskName = 'build-sprites ' + spritesPath,
        quality = typeof png8b === 'string' ? png8b : '100' // set quality as '70-80' string

    spritesBuildTasks.push(taskName)

    var format = '.png'

    if (String(png8b).indexOf('jpg') !== -1) {
        format = '.jpg'
        quality = String(png8b).split('-')[1] || 90
        png8b = false
    }

    gulp.task(taskName, function(taskDone) {
        var imagemin = require('gulp-imagemin')
        var pngquant = require('imagemin-pngquant')
        var spritesmith = require('gulp.spritesmith')
        var spritesSizeNormalizer = require('gulp-retina-sprites-normalizer')
        var imageminWebp = require('imagemin-webp')
        var rename = require('gulp-rename')

        var replaceDotRegexp = new RegExp('@+')

        var imgName = spriteName + format,
            retinaImgName = spriteName + '-2x' + format,
            cssName = spriteName + '.' + rasterSpritesConf.outFormat

        var winPathRegex = /\\+/g

        subDirectory = subDirectory || ''

        var imgBuildDirCss = path.join(rasterSpritesConf.imgBuildDirCss, subDirectory, imgName).replace(winPathRegex, '/'),
            retinaImgBuildDirCss = path.join(rasterSpritesConf.imgBuildDirCss, subDirectory, retinaImgName).replace(winPathRegex, '/')

        var spritesStream = gulp.src(path.join(spritesPath, rasterSpritesConf.chunksMask))

        if (!disableRetina) {
            spritesStream = spritesStream.pipe(spritesSizeNormalizer())
        }

        spritesStream = spritesStream.pipe(
            spritesmith(
                defaults(
                    {
                        padding: 4,
                        imgPath: imgBuildDirCss,
                        cssName: cssName,
                        imgName: imgName,
                        cssVarMap: function (sprite) {
                            sprite.name = (spriteNamePrefix || '') + sprite.name.replace(replaceDotRegexp, '-')
                        }
                    },
                    !disableRetina &&
                    {
                        retinaSrcFilter: path.join(spritesPath, rasterSpritesConf.chunksMaskRetina),
                        retinaImgPath: retinaImgBuildDirCss,
                        retinaImgName: retinaImgName
                    },
                    format === '.jpg' &&
                    {
                        imgOpts: {quality: quality}
                    }
                )
            )
        )

        spritesStream.css.pipe(gulp.dest(path.join(rasterSpritesConf.cssBuildDir, subDirectory)))

        var spriteImageDest = path.join(rasterSpritesConf.imgBuildDir, subDirectory)

        var imagesCompletePromise = new Promise(function (resolve) {
            spritesStream.img.pipe(gulp.dest(spriteImageDest).on('end', resolve))
        })

        imagesCompletePromise.then(function () {
            var optimizerPlugins = []

            if (png8b) {
                var optimizationQuality = Math.floor(quality * 0.80) + '-' + quality

                optimizerPlugins.push(pngquant({quality: optimizationQuality, speed: 4, nofs: true}))
            }


            var taskCompletePromise = new Promise(function (taskDone) {
                var webpDone,
                    pngDone

                var webpSavedPromise = new Promise(function (_webpDone) {
                    webpDone = _webpDone
                })

                var pngSavedPromise = new Promise(function (_pngDone) {
                    pngDone = _pngDone
                })

                gulp.src([path.join(spriteImageDest, imgName), path.join(spriteImageDest, retinaImgName)])
                    .pipe(imagemin(
                        optimizerPlugins.concat([
                            imagemin.svgo({plugins: [{removeViewBox: false}]}),
                            imagemin.jpegtran({progressive: true}),
                            imagemin.gifsicle(),
                            imagemin.optipng({optimizationLevel: 5})
                        ])
                    ))

                    // Basic format out
                    .pipe(gulp.dest(spriteImageDest).on('end', webpDone))

                    // Webp Format out
                    .pipe(
                        imagemin([imageminWebp({quality: 90})])
                    )
                    .pipe(rename({extname: '.webp'}))
                    .pipe(gulp.dest(spriteImageDest).on('end', pngDone))

                Promise.all([webpSavedPromise, pngSavedPromise]).then(taskDone)
            })

            taskCompletePromise.then(function () {
                waiteForOptimizer && taskDone()
            })
        })

        if (!waiteForOptimizer) {
            return spritesStream
        }
    })

    return taskName
}

function parseTaskAsArguments(task) {
    var png8 = false,
        jpeg = false

    if (task.jpg !== undefined && task.jpeg === undefined) {
        task.jpeg = task.jpg
    }

    if (task.jpeg) {
        jpeg = 'jpg' + (task.jpeg === true ? '' : '-' + task.jpeg)
    }
    else if (task.png8) {
        png8 = true
    }

    return [
        task.sourcePath, //sprites images source path
        jpeg || png8, // format
        !task.retina, // disable retina
        task.spriteVarPrefix || '', // sprite variable or selector name prefix
        task.buildSubDir // sprites build subdir
    ]
}

module.exports.addSpritesBuildTask = addSpritesBuildTask
module.exports.parseTaskAsArguments = parseTaskAsArguments
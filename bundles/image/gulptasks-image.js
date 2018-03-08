var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var path = require('path')
var fs = require('fs')
var defaults = require('lodash.defaults')
var runSequence = require('run-sequence')

var resolvePath = require('../lib').resolvePath
var mkdirp = require('../lib').mkdirp
var bundleCaption = require('../lib').getBundleCaption(__dirname)
var toCamelCase = require('../lib').toCamelCase

var spritesBuildTasks = []

var subDirReplaceRegex = /%subDir/i

var packageConfig = require('./package').config || {}

var rasterSpritesConf = defaults(
    packageConfig.rasterSprites || {},
    {
        chunksMask: '**/*.png',
        chunksMaskRetina: '**/*2x.png',
        cssBuildDir: '../../assets/less/build/sprites-rster',
        imgBuildDir: '../../assets/dist/img/build/sprites-raster', // eg: /sprite-one.png && /sprite-one-2x.png
        imgBuildDirCss: '../img/build/sprites-raster', // eg: /sprite-one.png && /sprite-one-2x.png
        outFormat: 'less'
    }
)

var svgSpritesConf = packageConfig.svgSprites || {}

var svgSymbolSpritesSVGONecessaryPlugins = [
    {removeViewBox: false},
    {removeTitle: false},
    {removeDesc: false},
    {cleanupIDs: false},
    {removeUselessStrokeAndFill: false},
    function SVGOUnifyIDs() {
        var SVGOUnifyIDs = require('svgo-plugin-unify-ids')

        return {unifyIDs: SVGOUnifyIDs}
    },
    function SVGOConvertDimensions() {
        var SVGOConvertDimensions = require('./svgo-plugin-convert-dimensions')

        return {convertDimensions: SVGOConvertDimensions}
    },
    {removeDimensions: true}
]

if (rasterSpritesConf && rasterSpritesConf.tasks && rasterSpritesConf.tasks.length) {
    rasterSpritesConf.tasks.forEach(function (task) {
        addSpritesBuildTask.apply(this, parseTaskAsArguments(task))
    })
}

gulp.task('build-sprites', 'Build raster sprites ' + bundleCaption, spritesBuildTasks, function () {
    // Alternatively you can create task directly by function not by config
    return runSequence(
        addSpritesBuildTask('../../assets/img/sprites/desktop/nope', false, false, 'icon-', 'desktop')
    )
})

function getSVGODefaultPlugins() {
    return svgSymbolSpritesSVGONecessaryPlugins.map(function (plugin) {
        if (plugin instanceof Function) {
            return plugin()
        }

        return plugin
    })
}

function createOptimizeSvgStream(svgSourceDir, additionalPlugins) {
    var imagemin = require('gulp-imagemin')
    var svgoPlugins = getSVGODefaultPlugins()

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
    var sourceDir = [].concat(svgSpritesConf.sourceDirSprites, svgSpritesConf.sourceDirSymbols)

    var eventStream = require('event-stream')

    var streams = sourceDir.map(function (sourceDir) {
        return createOptimizeSvgStream(sourceDir)
    })

    return eventStream.concat.apply(eventStream, streams)
})

function createSvgCombinerSpritesTask(svgSourceDir, svgBuildDir, svgBuildSubDir) {
    var svgSprite = require('gulp-svg-sprites'),
        rename = require('gulp-rename')

    svgBuildSubDir = svgBuildSubDir || ''

    var outStyleFile = svgSpritesConf.outStyleFile.sprite.replace(subDirReplaceRegex, svgBuildSubDir),
        styleFileFormat = path.extname(outStyleFile).replace(/^\./, '')

    var styleFileExtName = styleFileFormat === 'css' ? 'css' : 'scss'

    var outStyleFilePath = path.join(
        path.dirname(outStyleFile),
        path.basename(outStyleFile, '.' + styleFileFormat) + '.' + styleFileExtName
    )

    var outStyleFilePathRelative = path.relative(svgBuildDir, outStyleFilePath)

    // prepare in style svg url
    var styleSvgSpritePath = path.join(svgSpritesConf.styleSvgSpritePath.replace(subDirReplaceRegex, svgBuildSubDir))

    var templates = styleFileFormat === 'less' ?  {
        css: false,
        scss: fs.readFileSync(resolvePath('svg-sprite-less.template', __dirname), 'utf-8')
    } : {}

    return gulp.src(path.join(svgSourceDir, '**/*.svg'))
        .pipe(svgSprite({
            baseSize: 16,
            cssFile: outStyleFilePathRelative,
            svgPath: styleSvgSpritePath,
            selector: svgSpritesConf.selector,
            padding: 5,
            templates: templates,
            svg: {
                sprite: svgSpritesConf.spriteFileName
            },
            preview: false,
            cleanconfig: {plugins: getSVGODefaultPlugins()}
        }))
        .pipe(rename(function (path) {
            if (styleFileFormat === 'less' && path.extname === '.scss') {
                path.extname = '.less'
            }
        }))
        .pipe(gulp.dest(svgBuildDir))
}

function svgImagesPathsMap(sourceDir, buildBaseDir) {
    var useBuildSubDir = sourceDir instanceof Array

    var svgSourceDir = [].concat(sourceDir)

    return svgSourceDir.map(function (sourceDir) {
        sourceDir = resolvePath(sourceDir)

        var buildSubDir = useBuildSubDir ? path.basename(sourceDir) : ''

        var svgBuildDir = resolvePath(path.join(buildBaseDir, buildSubDir))

        var map = {}

        map[sourceDir] = svgBuildDir

        map['useBuildSubDir'] = useBuildSubDir

        return map
    })
}

/**
 * @param {Array} children
 * @return {Array}
 */
function extractSvgSymbolsDefs(children) {
    var defs = []

    var extractingElements = [
        'linearGradient', 'meshgradient', 'radialGradient', 'stop',
        'clipPath'
    ]

    for (var i = 0, item; i < children.length; i++) {
        item = children[i]

        var shouldExtract = extractingElements.indexOf(item.name) !== -1,
            removeChild = false

        if (shouldExtract) {
            defs = defs.concat(item)

            removeChild = true
        }
        else if (item.name === 'defs') {
            defs = defs.concat(item.children)

            removeChild = true
        }

        if (removeChild) {
            children.splice(i, 1)
            i--
        }

        if (!shouldExtract && item.children && item.children.length) {
            defs = defs.concat(extractSvgSymbolsDefs(item.children))
        }
    }

    return defs
}

function svgCombinerSymbolsTransformHook(data) {
    var XmlObject = require('svg-sprite-data/lib/xmlobject')

    data.svg.forEach(function (svg) {
        var svgXML = new XmlObject(svg.data)

        var defsNodes = extractSvgSymbolsDefs(svgXML.root().childNodes())

        var defs = defsNodes.reduce(function (prev, item) {
            var xml = svgXML.toXMLString(item)

            return prev + (typeof xml === 'string' ? xml : '')
        }, '')

        svg.defs = defs || ''
        svg.data = svgXML.toXMLString(svgXML.root().value())
    })

    return data
}

function createSvgCombinerSymbolsTask(svgSourceDir, svgBuildDir) {
    var svgSprite = require('gulp-svg-sprites')

    var templates = {
        previewSymbols: fs.readFileSync(resolvePath('svg-symbols-json.template', __dirname), 'utf-8'),
        symbols: fs.readFileSync(resolvePath('symbols-svg.template', __dirname), 'utf-8')
    }

    return gulp.src(path.join(svgSourceDir, '**/*.svg'))
        .pipe(svgSprite({
            baseSize: 16,
            padding: 0,
            selector: svgSpritesConf.selector,
            templates: templates,
            mode: 'symbols',
            svg: {
                symbols: svgSpritesConf.symbolFileName
            },
            preview: {
                symbols: getSymbolsJSONFileName()
                // symbols: false
            },
            cleanconfig: {plugins: getSVGODefaultPlugins()},
            afterTransform: svgCombinerSymbolsTransformHook
        }))
        .pipe(gulp.dest(svgBuildDir))
}

gulp.task('svg-combiner-symbols', 'Combine SVG sprites ' + bundleCaption, ['svg-optim'], function () {
    var svgSymbolsPathsMap = svgImagesPathsMap(svgSpritesConf.sourceDirSymbols, svgSpritesConf.buildDirSymbols)

    var eventStream = require('event-stream')

    var streams = svgSymbolsPathsMap.map(function (map) {
        var sourceDir = Object.keys(map).shift()

        var buildDir = map[sourceDir]

        return createSvgCombinerSymbolsTask(sourceDir, buildDir)
    })

    return eventStream.concat.apply(eventStream, streams)
})

gulp.task('svg-symbolizer', 'Combine SVG sprites to single file and write PHP and LESS files helpers' + bundleCaption, ['svg-combiner-symbols'], function () {
    var svgSymbolsPathsMap = svgImagesPathsMap(svgSpritesConf.sourceDirSymbols, svgSpritesConf.buildDirSymbols)

    svgSymbolsPathsMap.forEach(function (map) {
        var sourceDir = Object.keys(map).shift()

        var buildDir = map[sourceDir]

        var symbolsBaseUrlSubDir = map.useBuildSubDir ? path.basename(buildDir) : ''

        prepareSymbolsJsonToPhpHelper(buildDir, symbolsBaseUrlSubDir)

        prepareSymbolsJsonToLessHelper(buildDir, symbolsBaseUrlSubDir)
    })
})

gulp.task('svg-combiner', 'Combine SVG sprites ' + bundleCaption, ['svg-optim'], function () {
    var svgSpritesPathsMap = svgImagesPathsMap(svgSpritesConf.sourceDirSprites, svgSpritesConf.buildDirSprites)

    var eventStream = require('event-stream')

    var streams = svgSpritesPathsMap.map(function (map) {
        var sourceDir = Object.keys(map).shift()
        var buildDir = map[sourceDir]
        var buildSubDir = map.useBuildSubDir ? path.basename(buildDir) : ''

        return createSvgCombinerSpritesTask(sourceDir, buildDir, buildSubDir)
    })

    return eventStream.concat.apply(eventStream, streams)
})

function getSymbolsJSONFileName() {
    return path.basename(svgSpritesConf.symbolFileName, path.extname(svgSpritesConf.symbolFileName)) + '.json'
}

function prepareSymbolsJsonToPhpHelper(buildDir, symbolsBaseUrlSubDir) {
    symbolsBaseUrlSubDir = symbolsBaseUrlSubDir || ''

    var svgBuildDir = resolvePath(buildDir)

    var symbolsBaseUrl = svgSpritesConf.symbolsBaseUrl.replace(/%f/, path.join(symbolsBaseUrlSubDir, svgSpritesConf.symbolFileName))

    var phpTemplate = fs.readFileSync(resolvePath('svg-symbols-template.php', __dirname), 'utf-8'),
        symbolsList = JSON.parse(fs.readFileSync(path.join(svgBuildDir, getSymbolsJSONFileName()), 'utf-8'))

    var symbolsListPHP = Object.keys(symbolsList).reduce(function (resultPhp, symbolName) {
        var symbolData = symbolsList[symbolName]

        var symbolNamePhp = symbolName.replace(/[-\s]+/g, '_', symbolName).toUpperCase()

        var symbolDataPhp = [
            `'width' => ${symbolData.width}`,
            `'height' => ${symbolData.height}`,
            `'viewBox' => '${symbolData.viewBox}'`,
            `'originName' => '${symbolName}'`
        ]

        resultPhp[symbolNamePhp] = symbolDataPhp.join(', ')

        return resultPhp
    }, {})

    var REPLACING_IMAGES_LIST = Object.keys(symbolsListPHP).reduce(function (list, varName) {
        list.push(`'${varName}' => [${symbolsListPHP[varName]}]`)

        return list
    }, [])

    phpTemplate = phpTemplate.replace(/REPLACING_IMAGES_LIST/, REPLACING_IMAGES_LIST.join(',\n\t\t\t'))

    phpTemplate = phpTemplate.replace(/\[REPLACING_BASE_URL\]/, symbolsBaseUrl)

    if (symbolsBaseUrlSubDir) {
        var spritesPackName = toCamelCase(symbolsBaseUrlSubDir)
        var nameSpace = 'SvgImages' + spritesPackName

        phpTemplate = phpTemplate.replace(/SvgImagesNameSpace/g, nameSpace)

        phpTemplate = phpTemplate.replace(/SpritesPackFunctionName/g, spritesPackName)
    }

    var phpTemplateRows = phpTemplate.split('\n')

    var propertiesListRegexp = /(@property[\s\S]+)\s+\[ADDING_PROPERTIES_LIST_BELOW\][\s\S]*/

    for (var row = 0, rows = phpTemplateRows.length; row < rows; row++) {
        if (!propertiesListRegexp.test(phpTemplateRows[row])) {
            continue
        }

        var propertyRowTemplate = phpTemplateRows[row].replace(propertiesListRegexp, '$1')

        phpTemplateRows.splice(row, 1)

        Object.keys(symbolsListPHP).forEach(function (property) {
            phpTemplateRows.splice(row, 0, `${propertyRowTemplate} $${property}`)
        })

        phpTemplate = phpTemplateRows.join("\n")

        break
    }

    var phpFileName = path.basename(svgSpritesConf.symbolFileName, path.extname(svgSpritesConf.symbolFileName)) + '.php'

    mkdirp(svgBuildDir)

    fs.writeFileSync(path.join(svgBuildDir, phpFileName), phpTemplate)
}

function prepareSymbolsJsonToLessHelper(buildDir, symbolsSubDir) {
    var svgBuildDir = resolvePath(buildDir),
        outStyleFile = resolvePath(svgSpritesConf.outStyleFile.symbols).replace(subDirReplaceRegex, symbolsSubDir)

    outStyleFile = path.normalize(outStyleFile)

    var lessTemplate = fs.readFileSync(resolvePath('svg-symbols-template.less', __dirname), 'utf-8').trim(),
        symbolsList = JSON.parse(fs.readFileSync(path.join(svgBuildDir, getSymbolsJSONFileName()), 'utf-8'))

    var symbolsListLess = Object.keys(symbolsList).reduce(function (list, varName) {
        var symbol = symbolsList[varName]

        list.push(`@${varName}-width: ${symbol.width}px;`)
        list.push(`@${varName}-height: ${symbol.height}px;`)
        list.push(`@${varName}: 0 0 0 0 ${symbol.width}px ${symbol.height}px 0 0 '${varName}' '${varName}';`)

        return list
    }, [])

    symbolsListLess = symbolsListLess.join('\n')

    mkdirp(path.dirname(outStyleFile))

    fs.writeFileSync(outStyleFile, `${lessTemplate}\n${symbolsListLess}`)
}

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
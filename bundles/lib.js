var path = require('path')
var gutil = require('gulp-util')

function resolvePath(resolvingPath, basePath) {
    basePath = basePath || process.cwd()

    if (resolvingPath instanceof Array) {
        return resolvingPath
    }

    if (!path.isAbsolute(resolvingPath)) {
        resolvingPath = path.join(basePath, resolvingPath)
    }

    return path.resolve(resolvingPath)
}

function getPackageRelPath(dirname) {
    return path.relative(process.cwd(), path.join(dirname, 'package.json'))
}

function getBundleCaption(bundlePath) {
    var packageName = path.basename(bundlePath)

    packageName = gutil.colors.magenta(packageName)

    return gutil.colors.gray('{bundle: ' + packageName + ', config: ' + getPackageRelPath(bundlePath) + '}')
}

/**
 * Makes wildecard path. From ../some/sub/path to ..\/**\/**\/**
 * @param wildeCardPath Path
 * @param suffix Path suffix
 */
function pathWildeCard(wildeCardPath, suffix) {
    return path.join(path.normalize(wildeCardPath).replace(/([\/\\])[^\.\/\\]+/ig, '$1**'), suffix || '')
}

function globsResolvePath(globs, basePath) {
    if (!(globs instanceof Array)) {
        globs = [globs]
    }

    globs.forEach(function (glob, i) {
        var exclude = false

        if (glob.indexOf('!') === 0) {
            glob = glob.substr(1)
            exclude = true
        }

        if (!path.isAbsolute(glob)) {
            glob = (exclude ? '!' : '') + path.join(basePath, glob)

            globs[i] = glob
        }
    })

    return globs
}

module.exports.resolvePath = resolvePath
module.exports.pathWildeCard = pathWildeCard
module.exports.getPackageRelPath = getPackageRelPath
module.exports.getBundleCaption = getBundleCaption
module.exports.globsResolvePath = globsResolvePath
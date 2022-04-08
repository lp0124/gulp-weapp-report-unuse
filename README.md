## 使用

```
const { weappReport, weappReportSort } = require('@lp0124/gulp-weapp-report')
const sort = require('gulp-sort')
const out = require('gulp-out')

function report () {
  return src(['./dist/**/*.js', './dist/**/*.wxml'])
   .pipe(sort(weappReportSort))
   .pipe(weappReport())
   .pipe(out('report.html'))
}
```

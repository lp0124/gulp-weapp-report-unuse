const through2 = require('through2')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const HtmlDom = require('htmldom')

const htmlMaps = {}
const reportMaps = {}

function weappReport() {
  return through2.obj((file, _, cb) => {
    if (file.extname === ".wxml") {
      const temp = [];
      const html = new HtmlDom(file.contents.toString());
      let $ = html.$;

      $("*").each(function (index, item) {
        if ($(item)[0]) {
          const attrs = $(item)[0].attributes;

          Object.keys(attrs)
            .filter((v) => v.startsWith("bind") || v.startsWith("catch"))
            .forEach((key) => {
              temp.push(attrs[key]);
            });
        }
      });

      htmlMaps[`${file.relative.slice(0, -5)}.js`] = temp;
    }
    if (file.extname === ".js") {
      const sourceCode = file.contents.toString();

      const ast = parser.parse(sourceCode, {
        sourceType: "unambiguous",
      });

      const state = {
        do: false,
        methods: [],
      };
      // 获取页面、组件 js 中所有的方法
      traverse(ast, {
        CallExpression(path) {
          if (
            path.node.callee &&
            ["$page", "Page", "$component", "Component"].includes(
              path.node.callee.name
            )
          ) {
            state.do = true;
          }
        },
        ObjectMethod(path) {
          let isExternal = false;

          if (path.node.leadingComments) {
            path.node.leadingComments.forEach((comment) => {
              if (comment.value.includes("#__EXTERNAL__")) {
                isExternal = true;
              }
            });
          }

          if (isExternal) return;

          if (
            state.do === false ||
            [
              "onLoad",
              "onReady",
              "onUnload",
              "onShow",
              "onHide",
              "onReachBottom",
              "onPullDownRefresh",
              "onShareAppMessage",
              "observer",
              "attached",
              "detached",
              "$_changeTabbarIndex",
              "ready",
              "moved",
              "created",
              "error",
            ].includes(path.node.key.name)
          ) {
            return;
          }
          state.methods.push(path.node.key.name);
        },
      });
      // 过滤掉在 js 中被引用的方法（需要保证获取到所有的 methods 后再进行过滤）
      traverse(ast, {
        MemberExpression(path) {
          if (state.do === false) {
            return;
          }
          if (path.node.object.type === "ThisExpression") {
            state.methods = state.methods.filter(
              (v) => v !== path.node.property.name
            );
          }
        },
      });

      const report = [...new Set(state.methods)].filter((v) => {
        const res = htmlMaps[file.relative].find(
          (v2) => v2 && v2.indexOf(v) !== -1
        );
        return !res;
      });
      if (report.length) {
        reportMaps[file.relative] = report
      }
    }

    const htmlTpl = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <style>
          table {
            font-family: arial, sans-serif;
            border-collapse: collapse;
            width: 100%;
          }

          td, th {
            border: 1px solid #dddddd;
            text-align: left;
            padding: 8px;
          }

          tr:nth-child(even) {
            background-color: #dddddd;
          }
        </style>
      </head>
      <body>
        <h2>代码中存在未被使用到的方法，请自查后删除</h2>
        <p>若方法供外部使用请使用注释 /* #__EXTERNAL__ */ 标记</p>
        <table>
          <tr>
            <th>页面路径</th>
            <th>方法名</th>
          </tr>
          ${
            Object.keys(reportMaps).map(key => {
              const val = reportMaps[key]

              return `
                <tr>
                  <td>${key}</td>
                  <td>${val}</td>
                </tr>
              `
            }).join('')
          }
        </table>
      </body>
      </html>
    `

    file.contents = Buffer.from(
      htmlTpl
    )

    cb(null, file);
  });
}

function getWeight(path) {
  if (/(\.js)$/g.test(path)) {
    return 1
  } else if (/(\.wxml)$/g.test(path)) {
    return 2
  }
}

function weappReportSort(a, b) {
  const aValue = getWeight(a.relative);
  const bValue = getWeight(b.relative);
  return bValue - aValue
}

module.exports = {
  weappReport,
  weappReportSort
}

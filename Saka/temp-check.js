const fs = require('fs');
const glob = require('glob');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const files = glob.sync('**/*.tsx');
files.forEach(file=>{
  const code = fs.readFileSync(file,'utf8');
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['typescript','jsx'] });
  } catch(e) {
    return;
  }
  const bad = [];
  traverse(ast, {
    JSXText(path) {
      const text = path.node.value.trim();
      if (!text) return;
      const parent = path.parentPath.node;
      if (parent.type === 'JSXElement' && parent.openingElement.name && parent.openingElement.name.name !== 'Text') {
        bad.push({ text, parent: parent.openingElement.name.name, loc: path.node.loc });
      }
    }
  });
  if (bad.length) {
    console.log(file, bad.length);
    bad.forEach(b => console.log(' ', JSON.stringify(b)));
  }
});

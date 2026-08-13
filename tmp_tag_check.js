const fs = require('fs');
const path = 'src/pages/admin/DepartmentManagement.tsx';
const text = fs.readFileSync(path, 'utf8');
const tags = [...text.matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9]*)\b[^>]*>/g)].map(m => ({tag:m[0], name:m[1], start:m.index}));
const stack = [];
for (const t of tags) {
  const isClose = t.tag.startsWith('</');
  const name = t.name;
  if (['div','Dialog','DialogContent','DialogHeader','DialogTitle','DialogTrigger','DialogFooter','Card','CardContent','CardHeader','Table','TableBody','TableHeader','TableRow','TableHead','TableCell','Tabs','TabsList','TabsTrigger','AlertDialog','AlertDialogContent','AlertDialogHeader','AlertDialogDescription','AlertDialogFooter','AlertDialogTitle','Select','SelectTrigger','SelectContent','SelectItem'].includes(name)) {
    if (isClose) {
      if (!stack.length || stack[stack.length-1] !== name) {
        console.log('Mismatch close:', name, 'at index', t.start, 'tag=', t.tag);
        console.log('Stack tail:', stack.slice(-20));
        process.exit(1);
      }
      stack.pop();
    } else if (!t.tag.endsWith('/>')) {
      stack.push(name);
    }
  }
}
console.log('Remaining stack:', stack.slice(-20));
console.log('Length', stack.length);

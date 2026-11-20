const L=require('./lib'),CL=require('./cl_food');const fs=require('fs');
const c=L.createCanvas(1080,1200),x=c.getContext('2d');x.fillStyle='#1b2a3a';x.fillRect(0,0,1080,1200);
CL.cutLon(x,120,120,1.2,{state:'whole'});CL.cutLon(x,300,120,1.2,{state:'open'});CL.cutLon(x,480,120,1.2,{state:'fried',herb:1});
CL.cutLon(x,800,220,4,{state:'fried',herb:1,seed:2});
CL.eggCap(x,120,300,1.4);CL.ramLeaf(x,300,300,2);
const t0=Date.now();CL.cutLonPlate(x,540,800,1.1,{t:1});console.log('ms',Date.now()-t0);
fs.mkdirSync('previews',{recursive:true});c.encode('png').then(b=>fs.writeFileSync('previews/_cl_test.png',b));

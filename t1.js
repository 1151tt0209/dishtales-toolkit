process.chdir('D:/DishTales-hoathinh/botchien');
const L=require('D:/DishTales-hoathinh/botchien/lib');const Wd=require('D:/DishTales-hoathinh/botchien/world');const fs=require('fs');
const c=L.createCanvas(2160,1920),x=c.getContext('2d');
x.save();x.scale(0.7,0.7);x.translate(300,0);Wd.drawAerialNight(x,1);x.restore();
x.save();x.translate(1080,0);Wd.drawStreetNight(x);x.restore();
c.encode('png').then(b=>fs.writeFileSync('previews/t1.png',b));

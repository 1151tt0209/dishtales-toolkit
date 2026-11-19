const fs=require('fs');const L=require('./lib');const P=require('./props');const R=require('./river');const Pp=require('./people');
const out=L.createCanvas(1080*3,1920),o=out.getContext('2d');const c=L.createCanvas(1080,1920),x=c.getContext('2d');
function panel(i,fn){x.setTransform(1,0,0,1,0,0);x.filter='none';x.globalAlpha=1;x.fillStyle='#000';x.fillRect(0,0,1080,1920);fn(x);o.drawImage(c,i*1080,0);}
panel(0,x=>{R.sky(x,0,820);L.glow(x,600,760,500,'rgba(255,200,120,0.9)',0.9);R.bank(x,820,0.6,0.6,3);R.water(x,820,1920,1,600);R.mist(x,800,120,1,0.6);
 R.ghe(x,300,1150,0.8,1,{canopy:true,seed:2});R.ghe(x,800,1300,1,1,{flip:true,seed:5,hue:'#2f8f5a'});
 R.coUt(x,350,1640,1.2,{t:1,handA:[120,-80]});R.xuong(x,350,1700,1.3,1,{});
 R.xuong(x,820,1780,1.2,1,{ph:2,inside:(c)=>Pp.tourist(c,0,-30,0.85,{sit:1})});});
panel(1,x=>{x.fillStyle='#3a2a1a';x.fillRect(0,0,1080,1920);R.pot(x,540,700,1.4,{boil:1,items:(c,ly,Rr,k)=>{R.fish(c,-50,ly,1.2,0.3);R.lemongrass(c,40,ly-6,0.8,0.4);}});
 R.bowl(x,540,1500,1.6,{fill:R.bowlContents({noodles:true,toppings:8,chili:6,herbs:true})});
 R.porkBlock(x,250,1100,1.5,0);R.shrimp(x,500,1100,1.5,0.3);R.squid(x,700,1100,1.5,0);R.fishFlake(x,850,1100,1.5,0);R.eggplant(x,250,1250,1.5,0.2);R.lime(x,450,1250,1.5,0);});
panel(2,x=>{x.fillStyle='#4a3020';x.fillRect(0,0,1080,1920);R.basket(x,540,700,1,420,(c)=>{for(let i=0;i<8;i++)R.lilyStem(c,(i-4)*20,-250+i*60,1,0.3);for(let i=0;i<10;i++)R.dienDien(c,-250+i*50,100+(i%3)*60,1.3);for(let i=0;i<20;i++)R.leafSmall(c,-200+i*20,250,1.2,i);for(let i=0;i<20;i++)R.sprout(c,100+i*8,-100+i*12,1.2,i);});
 R.smellWave(x,300,1500,800,1100,1,1);});
fs.writeFileSync('previews/parts.png',out.toBuffer('image/png'));

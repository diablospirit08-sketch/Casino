/* ── Monte Carlo Poker Club chip renderer ── */
const CHIP_CFGS=[
  {val:25,   label:'$25',  sml:'25',  fs_f:.202,c1:'#1aaa38',c2:'#d4c000',ring:'#1a8228',lbl:'#0a5a1e'},
  {val:50,   label:'$50',  sml:'50',  fs_f:.202,c1:'#30b8ff',c2:'#1830b0',ring:'#1880c8',lbl:'#082870'},
  {val:100,  label:'$100', sml:'100', fs_f:.190,c1:'#e8c200',c2:'#0d0d0d',ring:'#a88000',lbl:'#7a5800'},
  {val:500,  label:'$500', sml:'500', fs_f:.179,c1:'#b038e0',c2:'#4040d0',ring:'#8820b8',lbl:'#380870'},
  {val:1000, label:'$1000',sml:'1K',  fs_f:.161,c1:'#cc1010',c2:'#e8c200',ring:'#bb0000',lbl:'#800000'},
  {val:10000,label:'$10K', sml:'10K', fs_f:.131,c1:'#c87028',c2:'#181818',ring:'#9a5010',lbl:'#5a1800'},
];

/* Find the highest denomination ≤ val (or lowest if val is below all) */
function chipCfg(val){
  let best=CHIP_CFGS[0];
  for(const c of CHIP_CFGS){if(c.val<=val)best=c;}
  return best;
}

function _cl(h,a){const n=parseInt(h.replace('#',''),16);return`rgb(${Math.min(255,(n>>16)+a)},${Math.min(255,((n>>8)&255)+a)},${Math.min(255,(n&255)+a)})`;}
function _cd(h,a){return _cl(h,-a);}

function _arcText(ctx,txt,cx,cy,r,ca,cw,fs,col,ls){
  ctx.save();ctx.font=`900 ${fs}px Arial`;ctx.fillStyle=col;
  ctx.textAlign='center';ctx.textBaseline='middle';
  const chars=txt.split('');
  const ws=chars.map(c=>ctx.measureText(c).width+ls);
  const tot=ws.reduce((s,w)=>s+w/r,0);
  let a=ca-(cw?tot/2:-tot/2);
  chars.forEach((ch,i)=>{
    const step=ws[i]/r,mid=cw?a+step/2:a-step/2;
    ctx.save();ctx.translate(cx+r*Math.cos(mid),cy+r*Math.sin(mid));
    ctx.rotate(mid+(cw?Math.PI/2:-Math.PI/2));ctx.fillText(ch,0,0);ctx.restore();
    cw?a+=step:a-=step;
  });
  ctx.restore();
}

function makeChipCanvas(val,S,dpr){
  dpr=dpr||Math.min(window.devicePixelRatio||2,3);
  const cfg=chipCfg(val);
  const cv=document.createElement('canvas');
  cv.width=S*dpr;cv.height=S*dpr;
  cv.style.width=S+'px';cv.style.height=S+'px';
  const ctx=cv.getContext('2d');ctx.scale(dpr,dpr);
  const cx=S/2,cy=S/2,R=S/2-.5;
  const BO=R*.958,BI=R*.748,CR=BI*.82;
  const full=S>=100,med=S>=40;
  const N=full?24:med?12:8;
  const label=S>=80?cfg.label:cfg.sml;

  ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#111';ctx.fillRect(0,0,S,S);

  /* silver rim */
  ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
  ctx.strokeStyle='#c0c0c0';ctx.lineWidth=Math.max(.8,R*.04);ctx.stroke();

  /* alternating segments */
  const GAP=full?.01:0;
  for(let i=0;i<N;i++){
    const a0=(i/N)*Math.PI*2-Math.PI/2+GAP,a1=((i+1)/N)*Math.PI*2-Math.PI/2-GAP,mid=(a0+a1)/2;
    const c=i%2===0?cfg.c1:cfg.c2;
    const gr=ctx.createLinearGradient(cx+BI*Math.cos(mid),cy+BI*Math.sin(mid),cx+BO*Math.cos(mid),cy+BO*Math.sin(mid));
    gr.addColorStop(0,_cd(c,45));gr.addColorStop(.1,_cd(c,15));gr.addColorStop(.38,c);
    gr.addColorStop(.62,_cl(c,55));gr.addColorStop(.85,_cl(c,15));gr.addColorStop(1,_cd(c,40));
    ctx.beginPath();ctx.arc(cx,cy,BO,a0,a1);ctx.arc(cx,cy,BI,a1,a0,true);ctx.closePath();
    ctx.fillStyle=gr;ctx.fill();
    if(full){ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=.6;ctx.stroke();}
  }

  /* band borders */
  ctx.beginPath();ctx.arc(cx,cy,BO,0,Math.PI*2);
  ctx.strokeStyle='rgba(0,0,0,.8)';ctx.lineWidth=Math.max(.5,R*.018);ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,BI,0,Math.PI*2);
  ctx.strokeStyle='rgba(0,0,0,.9)';ctx.lineWidth=Math.max(.8,R*.024);ctx.stroke();

  /* white dots at segment joints */
  if(med){
    const dr=Math.max(1.5,R*.034);
    for(let i=0;i<N;i++){
      const a=(i/N)*Math.PI*2-Math.PI/2;
      ctx.beginPath();ctx.arc(cx+(BO-dr)*Math.cos(a),cy+(BO-dr)*Math.sin(a),dr,0,Math.PI*2);
      ctx.fillStyle='#fff';ctx.fill();
    }
  }

  /* inner double rings */
  ctx.beginPath();ctx.arc(cx,cy,BI-R*.036,0,Math.PI*2);
  ctx.strokeStyle=cfg.ring;ctx.lineWidth=Math.max(.8,R*.045);ctx.stroke();
  if(full){
    ctx.beginPath();ctx.arc(cx,cy,BI-R*.077,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,0,0,.75)';ctx.lineWidth=R*.014;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,BI-R*.1,0,Math.PI*2);
    ctx.strokeStyle=cfg.ring;ctx.lineWidth=R*.03;ctx.globalAlpha=.7;ctx.stroke();ctx.globalAlpha=1;
    ctx.beginPath();ctx.arc(cx,cy,BI-R*.125,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,0,0,.65)';ctx.lineWidth=R*.012;ctx.stroke();
  }

  /* white center disc */
  const cg=ctx.createRadialGradient(cx-CR*.1,cy-CR*.14,2,cx,cy,CR);
  cg.addColorStop(0,'#fff');cg.addColorStop(.5,'#f9f9f9');cg.addColorStop(1,'#e4e4e4');
  ctx.beginPath();ctx.arc(cx,cy,CR,0,Math.PI*2);ctx.fillStyle=cg;ctx.fill();

  if(full){
    /* horizontal line texture + two divider lines */
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,CR,0,Math.PI*2);ctx.clip();
    ctx.strokeStyle='rgba(0,0,0,.02)';ctx.lineWidth=.7;
    for(let y2=-CR;y2<CR;y2+=2.5){ctx.beginPath();ctx.moveTo(cx-CR,cy+y2);ctx.lineTo(cx+CR,cy+y2);ctx.stroke();}
    [[cy-CR*.3],[cy+CR*.34]].forEach(([ly])=>{
      const dy2=ly-cy,half=Math.sqrt(Math.max(0,CR*CR-dy2*dy2))*.78;
      ctx.strokeStyle=cfg.ring;ctx.lineWidth=1.3;ctx.globalAlpha=.55;
      ctx.beginPath();ctx.moveTo(cx-half,ly);ctx.lineTo(cx+half,ly);ctx.stroke();
    });
    ctx.globalAlpha=1;ctx.restore();
    /* arc text */
    const arcR=CR-R*.105;
    _arcText(ctx,'MONTE CARLO',cx,cy,arcR,-Math.PI/2,true,Math.max(5,R*.082),cfg.lbl,1.1);
    _arcText(ctx,'POKER CLUB',cx,cy,arcR,Math.PI/2,false,Math.max(5,R*.077),cfg.lbl,1.1);
    /* crown */
    ctx.font=`bold ${Math.max(8,R*.13)}px serif`;ctx.fillStyle=cfg.lbl;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♛',cx,cy-CR+R*.26);
  }

  /* center border */
  ctx.beginPath();ctx.arc(cx,cy,CR,0,Math.PI*2);
  ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=Math.max(.5,R*.012);ctx.stroke();

  /* value text */
  const fs=full?(cfg.fs_f*R*2):(CR*.6*Math.pow(.82,Math.max(0,label.length-2)));
  ctx.font=`bold ${Math.max(6,fs)}px Georgia,serif`;
  ctx.fillStyle='#0a0a0a';ctx.textAlign='center';ctx.textBaseline='middle';
  if(full){ctx.shadowColor='rgba(0,0,0,.08)';ctx.shadowBlur=1.5;}
  ctx.fillText(label,cx,cy+(full?2:0));
  ctx.shadowBlur=0;ctx.shadowColor='transparent';

  /* shine overlay */
  const shine=ctx.createRadialGradient(cx-R*.16,cy-R*.22,2,cx,cy,R);
  shine.addColorStop(0,'rgba(255,255,255,.16)');shine.addColorStop(.38,'rgba(255,255,255,.02)');
  shine.addColorStop(1,'rgba(0,0,0,.18)');
  ctx.fillStyle=shine;ctx.fillRect(0,0,S,S);

  return cv;
}

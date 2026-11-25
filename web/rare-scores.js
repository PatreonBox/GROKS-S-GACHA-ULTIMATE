// Original stingers. The last three build toward a scored chord at the card turn.
const motifs=[
 {root:55,steps:[12,19,24],space:.12,voices:[0,7,12],wave:'sine'},
 {root:52,steps:[12,16,19,24,28],space:.14,voices:[0,7,16],wave:'triangle'},
 {root:50,steps:[12,19,22,26,31,34],space:.16,voices:[0,7,10,14],wave:'triangle'},
 {root:43,steps:[0,7,12,14,15,19,24],space:.27,voices:[0,12,15,19,26],wave:'sawtooth'},
 {root:42,steps:[12,18,19,24,27,30,31,36],space:.27,voices:[0,12,19,27,33],wave:'sawtooth'},
 {root:38,steps:[0,12,14,17,21,24,26,29,33,36],space:.3,voices:[0,7,12,17,21,29,36],wave:'sawtooth'}
];
const midi=n=>440*2**((n-69)/12);

export function startRareScore(ctx,master,index,impactMs,durationMs){
 const config=motifs[index],start=ctx.currentTime+.02,hit=impactMs/1000,length=durationMs/1000;
 const out=ctx.createGain(),sources=[],connections=[out];
 const ceiling=[.80,.87,.93,1.04,1.10,1.20][index];
 out.gain.value=ceiling;out.connect(master);
 function tone(note,at,extent,level,{wave='sine',attack=.025,cutoff=0,pan=0,slide=0}={}){
  const osc=ctx.createOscillator(),envelope=ctx.createGain(),t=start+Math.max(0,at);
  osc.type=wave;osc.frequency.setValueAtTime(midi(note),t);
  if(slide)osc.frequency.exponentialRampToValueAtTime(midi(note+slide),t+extent*.42);
  envelope.gain.setValueAtTime(.0001,t);
  envelope.gain.exponentialRampToValueAtTime(level,t+Math.min(attack,extent*.5));
  envelope.gain.exponentialRampToValueAtTime(.0001,t+extent);
  osc.connect(envelope);sources.push(osc);connections.push(osc,envelope);
  let node=envelope;
  if(cutoff){
   const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.42;
   node.connect(filter);node=filter;connections.push(filter);
  }
  if(ctx.createStereoPanner&&pan){
   const stereo=ctx.createStereoPanner();stereo.pan.value=pan;node.connect(stereo);node=stereo;connections.push(stereo);
  }
  node.connect(out);osc.start(t);osc.stop(t+extent+.015);
 }
 function foilBurst(){
  const lead=.16+index*.024,tail=.24+index*.047,peak=start+hit;
  const texture=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*(lead+tail)),ctx.sampleRate);
  const samples=texture.getChannelData(0);
  for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  const burst=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  burst.buffer=texture;filter.type='bandpass';filter.Q.value=.82;
  filter.frequency.setValueAtTime(440,peak-lead);
  filter.frequency.exponentialRampToValueAtTime(3300+index*310,peak);
  filter.frequency.exponentialRampToValueAtTime(440+index*100,peak+tail*.86);
  gain.gain.setValueAtTime(.0001,peak-lead);
  gain.gain.exponentialRampToValueAtTime(.14+index*.018,peak);
  gain.gain.exponentialRampToValueAtTime(.0001,peak+tail);
  burst.connect(filter);filter.connect(gain);gain.connect(out);
  sources.push(burst);connections.push(burst,filter,gain);
  burst.start(peak-lead);
 }
 const {root,steps,space,voices,wave}=config;
 // A rising figure opens into a cadential chord when the card flips.
 const first=Math.max(.1,hit-.18-(steps.length-1)*space);
 steps.forEach((step,i)=>tone(root+step,first+i*space,.34+i*.017,.04+i*.0045,{
  wave:index>=3?'triangle':wave,pan:(i%2?1:-1)*.45,cutoff:2200,attack:.014
 }));
 if(index>=3){
  const pad=hit*.96;
  [0,7,12,15].forEach((step,i)=>tone(root+step,0,pad,.028,{wave,attack:pad*.4,cutoff:460+i*100,pan:(i-1.5)*.3,slide:index>3?2:0}));
  const count=index+1;
  for(let i=0;i<count;i++)tone(root-11,hit*(i+.35)/(count+1),.23,.12+i*.01,{slide:-4,attack:.01});
 }
 tone(root-11,hit,.68,.37,{attack:.008,slide:-12});
 tone(root+24,hit,.14,.076,{wave:'triangle',attack:.006,slide:-5,cutoff:2500});
 foilBurst();
 voices.forEach((step,i)=>{
  tone(root+step,hit+i*.019,Math.min(1.2+i*.05,length-hit+.08),.08,{
   wave,cutoff:index>=3?1200+i*192:2500,attack:.035,pan:(i%2?1:-1)*.45
  });
  if(index>=3)tone(root+step+12,hit+.43+i*.074,.45,.044,{wave:'triangle',attack:.018,pan:(i%2?-1:1)*.48});
 });
 let timer=setTimeout(disconnect,(length+.25)*1000);
 function disconnect(){for(const node of connections)node.disconnect()}
 return ()=>{
  clearTimeout(timer);
  const end=ctx.currentTime+.055;
  out.gain.cancelScheduledValues(ctx.currentTime);out.gain.setTargetAtTime(.0001,ctx.currentTime,.009);
  for(const source of sources)source.stop(end);
  timer=setTimeout(disconnect,70);
 };
}

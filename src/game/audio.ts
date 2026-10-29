export class IslandAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private ambient?: GainNode;
  enabled = false;
  start(enabled: boolean) {
    this.enabled = enabled;
    if (!this.context && enabled) {
      this.context = new AudioContext();
      const ctx = this.context;
      this.master = ctx.createGain(); this.master.gain.value = .24; this.master.connect(ctx.destination);
      this.ambient = ctx.createGain(); this.ambient.gain.value = .25; this.ambient.connect(this.master);
      const buffer=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate),data=buffer.getChannelData(0);
      let last=0;
      for(let i=0;i<data.length;i++){last=(last+(.02*(Math.random()*2-1)))/1.02;data[i]=last*5;}
      const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=700;
      source.connect(filter);filter.connect(this.ambient);source.start();
      const tide=ctx.createOscillator(),tideGain=ctx.createGain();tide.frequency.value=.11;tideGain.gain.value=.12;tide.connect(tideGain);tideGain.connect(this.ambient.gain);tide.start();
    }
    if(this.context){void this.context.resume();this.master?.gain.setTargetAtTime(enabled?.24:0,this.context.currentTime,.3);}
  }
  tick(rain: boolean, paused: boolean) { if(this.context&&this.ambient)this.ambient.gain.setTargetAtTime(paused?.04:rain?.5:.25,this.context.currentTime,1); }
  play(type: string) {
    if(!this.enabled||!this.context||!this.master)return;
    const ctx=this.context;
    const notes=type==='achievement'?[440,554,659]:type==='build'?[330,440]:type==='hurt'?[120]:type==='eat'?[523,659]:[300,420];
    notes.forEach((frequency,i)=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.085;
      oscillator.type=type==='hurt'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,start);oscillator.frequency.exponentialRampToValueAtTime(frequency*.85,start+.25);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(type==='hurt'?.15:.23,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+.45);
      oscillator.connect(gain);gain.connect(this.master!);oscillator.start(start);oscillator.stop(start+.5);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });
  }
}

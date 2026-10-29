import { Session } from './game/session';
import { IslandWorld } from './render/IslandWorld';
import { Interface } from './ui/interface';
import { EYE_HEIGHT, UNIT } from './render/firstPerson';
import './style.css';
import './ui/first-person.css';

const session=new Session();
const ui=new Interface(session);
let world:IslandWorld|undefined;
try {
  world=new IslandWorld(session,()=>ui.ready());
} catch(error) {
  const loading=document.getElementById('loading')!;
  loading.innerHTML='<span>暂时无法启动 3D 画面</span><p>请使用支持 WebGL 2 的 Chrome、Edge 或 Safari，并启用图形加速。</p><button class="primary">重新尝试</button>';
  loading.classList.add('graphics-error');
  loading.querySelector('button')!.addEventListener('click',()=>location.reload());
  console.error('Could not initialize the first-person renderer:',error);
}
Object.assign(window,{
  render_game_to_text:()=>JSON.stringify({
    mode:!session.started?'title':session.model.state.status!=='playing'?session.model.state.status:session.paused?'paused':'playing',
    perspective:'first-person',
    position:session.model.state.player,
    coordinateSystem:'simulation pixels: x east, y south; 3D meters: x east, z south, y up',
    camera:world?{yaw:world.yaw,pitch:world.pitch,eyeHeight:EYE_HEIGHT,worldPosition:world.camera.position.toArray(),metersPerPixel:UNIT,fov:world.camera.fov}:null,
    pointerLocked:session.lookLocked,
    day:session.model.state.day,minute:session.model.state.minute,
    health:session.model.state.hp,food:session.model.state.hunger,water:session.model.state.thirst,stamina:session.model.state.energy,
    inventory:session.model.state.inventory,tools:session.model.state.tools,structures:session.model.state.structures,
    nearby:session.nearby?.name??null,objective:session.model.objective.title,achievements:session.model.state.achievements,
  }),
});
if(import.meta.env.DEV)Object.assign(window,{__CASTAWAY__:{session,world,scene:world}});

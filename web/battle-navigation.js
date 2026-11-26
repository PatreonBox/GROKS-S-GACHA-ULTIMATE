import {newAreas,newBadge} from './guide-progress.js';
import {ico} from './icons.js';
import {features} from './level-access.js';
import {lockAttributes,lockBadge} from './level-lock.js';

const modes={
 battle:{name:'Arenas',href:'#battle',icon:'battle'},
 campaign:{name:'Campaign',href:'#battle/campaign',icon:'crown'},
 training:{...features.training,notice:newAreas.training},
 arcade:{...features.arcade,notice:newAreas.remix},
 army:{...features.army,icon:'grid'}
};

function modeLink(key,level,current,compact){
 const {name,href,icon,level:required=0,notice}=modes[key],locked=level<required;
 const className=compact?'outline feature-shortcut '+key+'-shortcut arena-activity':'battle-mode-link';
 const label=locked?name+' · Level '+required+' required':name;
 const badge=locked?lockBadge(required):notice?newBadge(notice):'';
 return '<a class="'+className+'" data-battle-link="'+key+'"'+lockAttributes(required,level,href)+
  (key===current?' aria-current="page"':'')+(locked||compact?' aria-label="'+label+'" title="'+label+'"':'')+'>'+
  ico(icon)+'<span class="feature-label">'+name+'</span>'+badge+'</a>';
}

export function battleNavigation(current,level){
 return '<nav class="battle-navigation" aria-label="Battle modes">'+
  Object.keys(modes).map(key=>modeLink(key,level,current,false)).join('')+'</nav>';
}

export function arenaActivities(level){
 return ['training','arcade','army'].map(key=>modeLink(key,level,null,true)).join('');
}

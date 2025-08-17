import type { SpriteModule } from './types'
import { PlanetModule } from './modules/planet'
import { TerrainTileModule } from './modules/tile'
import { IconModule } from './modules/icon'

const modules: SpriteModule[] = [PlanetModule, TerrainTileModule, IconModule]
export function getModules(){ return modules }
export function getModuleById(id: string){ return modules.find(m=>m.id===id) }

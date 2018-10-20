'use strict'

const CATEGORY_GLOBAL = 9999,
	SKILL_FLYING_DISMOUNT = 65000001

module.exports = function FlyMore(dispatch) {
	let gameId = null,
		location = null,
		outOfEnergy = false,
		dismountByUser = false,
		mountDisabled = false,
		inCombat = false,
		mountSkill = -1,
		serverMounted = false,
		remountTimer = null

	dispatch.hook('S_LOGIN', 10, event => { ({gameId} = event) })

	dispatch.hook('S_CANT_FLY_ANYMORE', 'raw', () => false)
	dispatch.hook('S_PLAYER_CHANGE_FLIGHT_ENERGY', 1, event => { outOfEnergy = event.energy === 0 })

	dispatch.hook('C_PLAYER_LOCATION', 5, event => { location = {flying: false, pos: event.loc, dir: event.w} })
	dispatch.hook('C_PLAYER_FLYING_LOCATION', 4, event => {
		location = {flying: true, pos: event.loc, dir: event.w}
		if(outOfEnergy && event.type !== 7 && event.type !== 8) {
			event.type = 7
			return true
		}
	})

	dispatch.hook('S_SKILL_CATEGORY', 3, event => { if(event.category === CATEGORY_GLOBAL) mountDisabled = !event.enabled })
	dispatch.hook('S_USER_STATUS', 2, event => { if(event.gameId.equals(gameId)) inCombat = event.status === 1 })

	dispatch.hook('C_START_SKILL', dispatch.base.majorPatchVersion < 74 ? 6 : 7, event => {
		if(event.skill.id === mountSkill || event.skill.id === SKILL_FLYING_DISMOUNT) {
			dismountByUser = true
			mountSkill = -1
		}
	})

	dispatch.hook('S_MOUNT_VEHICLE', 2, {order: 10}, event => {
		if(event.gameId.equals(gameId)) {
			const fakeMounted = mountSkill !== -1

			serverMounted = true
			mountSkill = event.skill

			if(fakeMounted) return false
		}
	})

	dispatch.hook('S_UNMOUNT_VEHICLE', 2, {order: 10}, event => {
		if(!event.gameId.equals(gameId)) return

		serverMounted = false

		if(!location.flying || dismountByUser) {
			dismountByUser = false
			mountSkill = -1
		}
		else {
			clearTimeout(remountTimer)
			remountTimer = setTimeout(tryRemount, 50)
			return false
		}
	})

	function tryRemount() {
		if(!mountDisabled && !inCombat) {
			dispatch.send('C_START_SKILL', dispatch.base.majorPatchVersion < 74 ? 6 : 7, {
				skill: mountSkill,
				w: location.dir,
				loc: location.pos,
				unk: true
			})
			remountTimer = setTimeout(() => {
				if(!serverMounted) {
					dispatch.send('S_UNMOUNT_VEHICLE', 2, {gameId, skill: mountSkill})
					mountSkill = -1
				}
			}, 1000)
		}
		else {
			dispatch.send('S_UNMOUNT_VEHICLE', 2, {gameId, skill: mountSkill})
			mountSkill = -1
		}
	}
}

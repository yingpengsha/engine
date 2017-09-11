import { ensureArray } from '../util'
import { TRANSACTION_REPAINT, TRANSACTION_FIRST_PAINT } from './constant'
import { walkCnodes } from '../common'
import { createInitialTraversor, createSingleStepPatchTraversor } from './vnode'
import createStateTree from './createStateTree'
import createAppearance from './createAppearance'

function createModuleSystem() {
  return {
    inject: () => ({}),
    hijack: (fn, ...argv) => fn(...argv),
    initialize: () => {},
    update: () => {},
    destroy: () => {},
  }
}

/**
 * controller 是把 renderer/view 统一在一起的抽象层。
 * 注意，对整个引擎架构的约定知道这里为止。至于 noviceController 中的 background 抽象
 * 纯属 noviceController 内部架构约定。
 *
 * @param plugins
 * @returns {*}
 */
export default function createNoviceController(initialState, initialAppearance, mods = {}) {
  let scheduler = null
  let view = null
  let ctree = null
  let cnodeToDigest = []

  // let currentTransaction = null
  // const transactionCallback = []
  let onChange = () => {}

  // TODO transaction 现在好像没什么用
  function transaction(name, fn) {
    // currentTransaction = name
    const result = fn()
    // currentTransaction = null
    // TODO call transaction callback
    return result
  }

  // 对外提供的接口
  function paint(vnode, domElement) {
    transaction(TRANSACTION_FIRST_PAINT, () => {
      ctree = scheduler.paint(vnode)
    })

    // CAUTION traversor 会在 build 读取的过程中动态往 ctree 上添加 ref/viewRefs 引用
    view.initialDigest(createInitialTraversor(ctree), domElement)
  }

  function repaint(cnodeRefs) {
    transaction(TRANSACTION_REPAINT, () => {
      scheduler.repaint(cnodeRefs)

      // cnodeToDigest 是 updateRender 时塞进去的
      cnodeToDigest.forEach((currentCnode) => {
        // 后面参数中的 cnode.viewRefs 是在 generateInitialTraversor 中生成的
        // CAUTION traversor 会在 build 读取的过程中动态往 ctree 上添加 ref/viewRefs 引用
        view.updateDigest(createSingleStepPatchTraversor(currentCnode), currentCnode.getViewRefs())
      })

      cnodeToDigest = []
      onChange(ctree)
    })
  }

  // 基础设施

  const stateTree = createStateTree(initialState, repaint)
  const appearance = createAppearance(initialAppearance, repaint)
  // 上层模块系统
  // TODO controller 要把 view batch 传给 moduleSystem,
  // 但是对 module 来说，仍然只是和 controller 的约定, controller 应该对 module 屏蔽 view 概念
  const moduleSystem = createModuleSystem(mods, stateTree, appearance, view)

  return {
    // 创建 background 只是为了把一部分 controller 的功能抽出去，得到一个更平整的抽象，用于构建更上层的系统
    renderer: {
      rootRender(cnode) {
        // root 没有注入任何东西
        return ensureArray(cnode.type.render())
      },
      // TODO appearance 也要 hijack 怎么办？拆成两部分，一部分是基础设施，一部分是 module？
      initialRender(cnode, parent) {
        const { render } = cnode.type
        stateTree.initialize(cnode)
        appearance.initialize(cnode)
        // view ref 在 cnode 上，要注入给 moduleSystem
        moduleSystem.initialize(cnode, parent)

        const injectArgv = {
          ...stateTree.inject(cnode, parent),
          ...moduleSystem.inject(cnode, parent),
        }
        // CAUTION 注意这里我们注意的参数是一个，不是数组
        // TODO 在这里要把 ref 改成指向组件的函数
        return ensureArray(moduleSystem.hijack(render, injectArgv))
      },
      // TODO appearance 也要 hijack 怎么办？拆成两部分，一部分是基础设施，一部分是 module？
      updateRender: {
        fn(cnode) {
          const { render } = cnode.type
          // view ref 在 cnode 上，要注入给 moduleSystem
          moduleSystem.update(cnode)
          const injectArgv = {
            ...stateTree.inject(cnode),
            ...moduleSystem.inject(cnode),
            refs: cnode.getRefs(),
            viewRefs: cnode.getViewRefs(),
          }

          // 把上一次 ret 存一下，之后计算 patch 要用
          cnode.modified = { ret: cnode.ret }
          cnodeToDigest.push(cnode)
          return ensureArray(moduleSystem.hijack(render, injectArgv))
        },
        review(cnode, [toInitialize, toDestroy, toRemain]) {
          // 先销毁要销毁的
          walkCnodes(toDestroy, (current) => {
            stateTree.destroy(current.statePath)
            appearance.destroy(current.statePath)
            moduleSystem.destroy(current)
          })

          // 存一下 update 中需要 initialize 的，之后计算 patch 要用
          cnode.modified.toInitialize = toInitialize
          cnode.modified.toRemain = toRemain
        },
      },
    },
    // controller 的 intercepter 接口
    intercepter: {
      intercept(...argv) {
        const [toInitialize] = argv[0]
        // CAUTION 这里决定了我们的更新模式是精确更新，始终只渲染要新增的，remain 的不管。
        // TODO 这里对 toRemain 的没有进行判断 children 是否发生了变化！！！！！
        return toInitialize
      },
    },

    observer: {
      invoke: () => {
        view.batch(() => {

        })
      },
      // TODO 在这里要实现 didMount
    },

    paint,
    repaint,
    // 存储外部传入的 scheduler
    receiveScheduler: s => scheduler = s,
    receiveView: v => view = v,
    // for debug
    onChange: o => onChange = o,
    getCtree: () => ctree,
    getStateTree: () => stateTree,

    dump() {

    },
  }
}

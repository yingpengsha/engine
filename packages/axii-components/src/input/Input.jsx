/** @jsx createElement */
/** @jsxFrag Fragment */
import {
  propTypes,
  createElement,
  Fragment,
  atom,
  createComponent,
  atomComputed,
  vnodeComputed,
  watchReactive,
  createRef,
} from 'axii';
import scen from '../pattern'

/**
 * Input feature 规划：
 * feature 并不是独立增加的单元，只是一种隔离代码的方式。如果组件结构复杂，那么最好在一开始就规划好。
 * 或者有个规划位置的作为 base。
 *
 * 外部不应该改变 focused 的值，而只应该使用 focus() api。
 * 状态其实是行为的总结，语义是比事件少的，因此应该优先选择 api。
 */

export function Input({value, onChange, children, placeholder, ref: parentRef, ...rest}, fragments) {
  const prefixLikeProps = {
    'flex-display-inline': true,
    'flex-align-items-center': true,
    'inline-padding': `0 ${scen().spacing()}px`
  }

  const prefixVnode = fragments.prefix()(() => {
    return children.prefix ? <prefix slot inline {...prefixLikeProps} inline-border-right-width-1px/> : null
  })

  const suffixVnode = fragments.suffix()(() => {
    return children.suffix ? <suffix slot inline {...prefixLikeProps} inline-border-left-width-1px/> : null
  })

  const beforeVnode = fragments.before()(() => {
    return children.before ? <before slot inline {...prefixLikeProps} inline-border-right-width-1px/> : null
  })

  const afterVnode = fragments.after()(() => {
    return children.after ? <after slot inline {...prefixLikeProps} inline-border-left-width-1px/> : null
  })

  return (
    <container inline flex-display-inline block-border-width-1px flex-align-items-stretch>
      {prefixVnode}
      <middle inline flex-display-inline flex-grow-1 flex-align-items-stretch inline-max-width="100%">
        {beforeVnode}
        <input
          flex-grow-1
          inline
          inline-border-width-0
          inline-max-width="100%"
          inline-box-sizing="border-box"
          inline-font-size={scen().fontSize()}
          inline-padding={`${scen().spacing()}px ${scen().spacing()}px `}
          value={value}
          onInput={onChange}
          placeholder={placeholder}
          ref={parentRef}
          {...rest}
        />
        {afterVnode}
      </middle>
      {suffixVnode}
    </container>
  )
}

// Input.useChildrenSlot
Input.useNamedChildrenSlot = true
Input.forwardRef = true

Input.propTypes = {
  value: propTypes.string.default(() => atom('')),
  placeholder: propTypes.string.default(() => atom('')),
  // onChange 这个函数会由系统自动补足三个参数： draftProps, props, event
  // 所以当我们直接把这个参数传到事件上时，不用冗余去写成 (e) => onChange(e.target.value)
  // 外部也同样推荐这种模式。
  onChange: propTypes.callback.default(() => ({value}, props, e) => {
    value.value = e.target.value
  })
}

Input.Style = (fragments) => {
  const rootElements = fragments.root.elements

  rootElements.input.onFocus((e, {onFocus}) => {
    onFocus()
  })

  rootElements.input.onBlur((e, {onBlur}) => {
    onBlur()
  })

  rootElements.container.style(({focused}) => {
    return {
      borderStyle: 'solid',
      borderWidth: 1,
      borderRadius: scen().radius(),
      borderColor: focused.value ?
        scen().interactable().active().color() :
        scen().separateColor(),
      boxShadow: focused.value ?
        `0 0 0 ${scen().outlineWidth()}px ${scen().interactable().active().shadowColor()}` :
        undefined
    }
  })

  rootElements.input.style(() => ({
    color: scen().color(),
    lineHeight: `${scen().lineHeight()}px`,
    outline: 0
  }))

  const commonPrefixStyle = {
    color: scen().color(),
    backgroundColor: scen().fieldColor(),
    borderStyle: 'solid',
    borderColor: scen().separateColor(),
    borderWidth: 0,
  }

  fragments.prefix.elements.prefix.style(commonPrefixStyle)
  fragments.suffix.elements.suffix.style(commonPrefixStyle)

  const commonAfterStyle = {
    color: scen().color(),
    borderStyle: 'solid',
    borderWidth: 0,
    borderColor: scen().separateColor()
  }
  fragments.before.elements.before.style(commonAfterStyle)
  fragments.after.elements.after.style(commonAfterStyle)
}

Input.Style.propTypes = {
  focused: propTypes.bool.default(() => atom(false)),
  onFocus: propTypes.callback.default(() => ({focused}) => focused.value = true),
  onBlur: propTypes.callback.default(() => ({focused}) => focused.value = false)
}

export default createComponent(Input)


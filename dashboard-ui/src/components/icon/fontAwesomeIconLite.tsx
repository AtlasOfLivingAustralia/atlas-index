


const FontAwesomeIconLite = (props: any) => {
    return <svg aria-hidden="true" focusable="false" data-prefix={props.icon.prefix} data-icon={props.icon.name}
                className={"svg-inline--fa " + props.className} role="img"
                xmlns="http://www.w3.org/2000/svg" viewBox={"0 0 " + props.icon.icon[0] + " " + props.icon.icon[1]}>
        <path fill="currentColor"
              d={props.icon.icon[4]}></path>
    </svg>
}

export default FontAwesomeIconLite;



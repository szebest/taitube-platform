import {
	Sidebar as ReactSidebar,
	Menu,
	MenuItem,
	SubMenu,
} from "react-pro-sidebar";
import { Link } from "react-router-dom";

import styles from "./sidebar.module.scss";

import { useAuth, useSidebar } from "src/modules/shared/providers";

import { Logo } from "..";
import { Dropdown } from "react-bootstrap";

export function Sidebar() {
	const { collapsed, isBelowBreakpoint, breakpointChanged, toggle, close } = useSidebar();
	const { user, isLoading } = useAuth();

	const width = '210px';

	if (isLoading) return <div style={{ width }}></div>;

	return (
		<ReactSidebar
			className={styles.sidebar}
			width={width}
			collapsedWidth="0px"
			backgroundColor="white"
			collapsed={collapsed}
			toggled={!collapsed}
			breakPoint="md"
			onBreakPoint={breakpointChanged}
			onBackdropClick={toggle}
		>
			{isBelowBreakpoint && <div className={styles.sidebar__logo}><Logo /></div>}
			<Menu>
				<MenuItem component={<Link to='/' onClick={close} />}> Home </MenuItem>
				{user && <MenuItem component={<Link to='/subscriptions' onClick={close} />}> Subscriptions </MenuItem>}

				<Dropdown.Divider></Dropdown.Divider>

				{user && 
					<>
						<MenuItem component={<Link to={`/profile/${user.id}`} onClick={close} />}> Your channel </MenuItem>
						<Dropdown.Divider></Dropdown.Divider>
					</>
				}

				<MenuItem component={<Link to='/trending' onClick={close} />}> Trending </MenuItem>
			</Menu>
		</ReactSidebar>
	);
}

export default Sidebar;

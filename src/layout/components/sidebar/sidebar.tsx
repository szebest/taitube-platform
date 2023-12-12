import { useMemo, useState } from "react";
import {
	Sidebar as ReactSidebar,
	Menu,
	MenuItem
} from "react-pro-sidebar";
import { Dropdown } from "react-bootstrap";
import { Link } from "react-router-dom";

import styles from "./sidebar.module.scss";

import { useAuth, useSidebar } from "src/modules/shared/providers";

import { Logo, SidebarSubscriptions } from "..";

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
				<MenuItem component={<Link to='/' onClick={close} />}>
					<i className="bi bi-house-door-fill"></i>
					<span>Home</span>
				</MenuItem>
				{user && <MenuItem component={<Link to='/subscriptions/videos' onClick={close} />}>
					<i className="bi bi-play-btn-fill"></i>
					<span>Subscription videos</span>
				</MenuItem>}

				<Dropdown.Divider></Dropdown.Divider>

				{user && 
					<>
						<MenuItem component={<Link to={`/profile/${user.id}`} onClick={close} />}>
							<i className="bi bi-person-fill"></i>
							<span>Your channel</span>
						</MenuItem>
						<Dropdown.Divider></Dropdown.Divider>
					</>
				}

				{
					user && <SidebarSubscriptions close={close} />
				}

				<MenuItem component={<Link to='/trending' onClick={close} />}>
					<i className="bi bi-fire"></i>
					<span>Trending</span>
				</MenuItem>
			</Menu>
		</ReactSidebar>
	);
}

export default Sidebar;

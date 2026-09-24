import { useState } from "react";
import { MenuItem } from "react-pro-sidebar";
import { Dropdown } from "react-bootstrap";
import { Link } from "react-router-dom";

import styles from "./sidebar-subscriptions.module.scss";

import { useMySubscriptionsQuery } from "src/modules/shared/api";

import { ProfilePicture } from "src/modules/shared/components";

export type SidebarSubscriptionsProps = {
	close: VoidFunction
}

const SUBSCRIPTIONS_COLLAPSED_AMOUNT = 5;

export function SidebarSubscriptions({ close }: SidebarSubscriptionsProps) {
	const [subscriptionsCollapsed, setSubscriptionsCollapsed] = useState(true);

	const { data } = useMySubscriptionsQuery();

	const channels = data?.items;
	const hasMore = channels !== undefined && channels.length > SUBSCRIPTIONS_COLLAPSED_AMOUNT;
	const shown = subscriptionsCollapsed ? channels?.slice(0, SUBSCRIPTIONS_COLLAPSED_AMOUNT) : channels;

	return (
		<>
			<MenuItem component={<Link to="/subscriptions" onClick={close} />}>
				<i className="bi bi-people-fill" />
				<span>Subscriptions: {channels?.length}</span>
			</MenuItem>

			{shown?.map((channel) => (
					<MenuItem key={channel.id} className={styles.item} component={<Link className="ps-menu-img" to={`/channel/${channel.id}`} onClick={close} />}>
						<span className={styles.item__avatar}>
							<ProfilePicture src={channel.avatarUrl} />
						</span>
						<span className={styles.item__name} title={channel.displayName}>
							{channel.displayName}
						</span>
					</MenuItem>
				))}

			{hasMore &&
				<MenuItem onClick={() => setSubscriptionsCollapsed((prev) => !prev)}>
					{subscriptionsCollapsed ? (
						<>
							<i className="bi bi-arrow-down" />
							<span>Show more</span>
						</>
					) : (
						<>
							<i className="bi bi-arrow-up" />
							<span>Show less</span>
						</>
					)}
				</MenuItem>
			}

			<Dropdown.Divider />
		</>
	);
}

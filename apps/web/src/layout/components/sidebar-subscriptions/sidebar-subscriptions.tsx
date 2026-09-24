import { useMemo, useState } from "react";
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

	const subscriptions = useMemo(() => {
		if (!data) return data;

		return subscriptionsCollapsed
			? data.items.slice(0, SUBSCRIPTIONS_COLLAPSED_AMOUNT)
			: data.items;
	}, [data, subscriptionsCollapsed]);

	return (
		<>
			<MenuItem component={<Link to="/subscriptions" onClick={close} />}>
				<i className="bi bi-people-fill" />
				<span>Subscriptions: {subscriptions?.length}</span>
			</MenuItem>

			{subscriptions?.map((channel) => (
					<MenuItem key={channel.id} className={styles.item} component={<Link className="ps-menu-img" to={`/channel/${channel.id}`} onClick={close} />}>
						<span className={styles.item__avatar}>
							<ProfilePicture src={channel.avatarUrl} />
						</span>
						<span className={styles.item__name} title={channel.displayName}>
							{channel.displayName}
						</span>
					</MenuItem>
				))}

			{subscriptions && subscriptions.length > SUBSCRIPTIONS_COLLAPSED_AMOUNT &&
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

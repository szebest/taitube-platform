import { useMemo, useState } from "react";
import { MenuItem } from "react-pro-sidebar";
import { Dropdown } from "react-bootstrap";
import { Link } from "react-router-dom";

import styles from "./sidebar-subscriptions.module.scss";

import { useGetUserSubscriptionsQuery } from "src/modules/shared/api";

import { ProfilePicture } from "src/modules/shared/components";

export type SidebarSubscriptionsProps = {
	close: VoidFunction
}

const SUBSCRIPTIONS_COLLAPSED_AMOUNT = 5;

export function SidebarSubscriptions({ close }: SidebarSubscriptionsProps) {
	const [subscriptionsCollapsed, setSubscriptionsCollapsed] = useState(true);

	const { data: subscriptionsData } = useGetUserSubscriptionsQuery({});

	const subscriptions = useMemo(() => {
		if (!subscriptionsData) return subscriptionsData;

		const subscriptionsFiltered = subscriptionsData.filter(
			(x) => x.isSubscribed
		);

		return subscriptionsCollapsed
			? subscriptionsFiltered.slice(0, SUBSCRIPTIONS_COLLAPSED_AMOUNT)
			: subscriptionsFiltered;
	}, [subscriptionsData, subscriptionsCollapsed]);

	return (
		<>
			<MenuItem component={<Link to="/subscriptions" onClick={close} />}>
				<i className="bi bi-people-fill"></i>
				<span>Subscriptions: {subscriptions?.length}</span>
			</MenuItem>

			{subscriptions &&
				subscriptions.map((subscription) => (
					<MenuItem key={subscription.userId} className={styles.item} component={<Link className="ps-menu-img" to={`/user/${subscription.userId}`} onClick={close} />}>
						<span className={styles.item__avatar}>
							<ProfilePicture src={subscription.profilePictureSrc} />
						</span>
						<span className={styles.item__name} title={subscription.userFullName}>
							{subscription.userFullName}
						</span>
					</MenuItem>
				))}

			{subscriptions && subscriptions.length > SUBSCRIPTIONS_COLLAPSED_AMOUNT &&
				<MenuItem onClick={() => setSubscriptionsCollapsed((prev) => !prev)}>
					{subscriptionsCollapsed ? (
						<>
							<i className="bi bi-arrow-down"></i>
							<span>Show more</span>
						</>
					) : (
						<>
							<i className="bi bi-arrow-up"></i>
							<span>Show less</span>
						</>
					)}
				</MenuItem>
			}

			<Dropdown.Divider></Dropdown.Divider>
		</>
	);
}

export default SidebarSubscriptions;

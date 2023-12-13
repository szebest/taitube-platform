import { useMemo, useState } from "react";
import { MenuItem } from "react-pro-sidebar";
import { Dropdown } from "react-bootstrap";
import { Link } from "react-router-dom";

import styles from "./sidebar-subscriptions.module.scss";

import { useGetUserSubscriptionsQuery } from "src/modules/shared/api";

export type SidebarSubscriptionsProps = {
	close: () => void
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
					<MenuItem key={subscription.userId} component={<Link to={`/user/${subscription.userId}`} onClick={close} />}>
						{subscription.userFullName}
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

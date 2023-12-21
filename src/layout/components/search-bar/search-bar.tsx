import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button, Form, InputGroup } from "react-bootstrap";

import styles from "./search-bar.module.scss";

import { useSearchBar } from "src/modules/shared/providers";

import { SearchBarModel } from "src/modules/shared/models";

export function SearchBar() {
	const { searchText, search, fullscreenSearch, setFullscreenSearch } = useSearchBar();
	
	const {
		reset,
		register,
		handleSubmit
	} = useForm<SearchBarModel>({ defaultValues: { searchText: "" } });

	useEffect(() => {
		if (searchText.length === 0) return;
		
		reset({
			searchText
		})
	}, [searchText]);

	useEffect(() => {
		if (!fullscreenSearch) return;
		
		const searchBar = document.getElementById("search-bar");

		if (!searchBar) return;

		searchBar.focus();
	}, [fullscreenSearch]);

	return (
		<form className={`${styles.container} ${fullscreenSearch ? styles.visible : ''}`} onSubmit={handleSubmit(search)}>
			<div className={styles.cancel}>
				<Button className="btn-light btn-transparent btn-borderless btn-round" onClick={() => setFullscreenSearch(false)}>
					<i className="bi bi-arrow-left"></i>
				</Button>
			</div>
			<InputGroup>
				<Form.Control id="search-bar" {...register("searchText")} />
				<Button className="btn-light btn-transparent" type="submit">
					<i className="bi bi-search"></i>
				</Button>
			</InputGroup>
		</form>
	);
}

export default SearchBar;

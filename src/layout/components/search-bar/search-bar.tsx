import { useCallback, useEffect } from "react";
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
		handleSubmit,
		watch
	} = useForm<SearchBarModel>({ defaultValues: { searchText: "" } });

	const focusInputField = useCallback(() => {
		const searchBar = document.getElementById("search-bar");

		if (!searchBar) return;

		searchBar.focus();
	}, []);

	const handleClear = () => {
		reset({ searchText: "" }); 
		focusInputField();
	}

	useEffect(() => {
		if (searchText.length === 0) return;
		
		reset({
			searchText
		})
	}, [searchText]);

	useEffect(() => {
		if (!fullscreenSearch) return;
		
		focusInputField();
	}, [fullscreenSearch, focusInputField]);

	return (
		<form className={`${styles.container} ${fullscreenSearch ? styles.visible : ''}`} onSubmit={handleSubmit(search)}>
			<div className={styles.cancel}>
				<Button className="btn-light btn-transparent btn-borderless btn-round" onClick={() => setFullscreenSearch(false)}>
					<i className="bi bi-arrow-left"></i>
				</Button>
			</div>
			<InputGroup>
				<Form.Control id="search-bar" {...register("searchText")} />
				{watch("searchText").length > 0 &&
					<Button className="btn-light btn-transparent" type="button" onClick={handleClear}>
						<i className="bi bi-x-lg"></i>
					</Button>
				}
				<Button className="btn-light btn-transparent" type="submit">
					<i className="bi bi-search"></i>
				</Button>
			</InputGroup>
		</form>
	);
}

export default SearchBar;

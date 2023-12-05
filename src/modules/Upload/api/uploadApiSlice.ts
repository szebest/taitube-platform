import axios from "axios";

import { baseApi } from "src/base-api";

import { UploadFormModel } from "../models";

import { API_BASE_URL } from "src/config";

export const uploadApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadProgress: builder.query<number, void>({
      queryFn: () => ({data: 0})
    }),
    upload: builder.mutation<void, UploadFormModel>({
      queryFn: async (form, api) => {

        return new Promise(async (resolve, reject) => {
          try {
            const { file, title, description, category } = form;
  
            const formData = new FormData();
  
            formData.append("file", file[0]);
            formData.append("title", title);
            formData.append("description", description);
            formData.append("category", category);

            api.dispatch(uploadApiSlice.util.updateQueryData('uploadProgress', void 0, (x) => {
              return 0;
            }));
  
            const res = await axios.post(`${API_BASE_URL}/videos/upload`, formData, {
              onUploadProgress: progress => {
                api.dispatch(uploadApiSlice.util.updateQueryData('uploadProgress', void 0, (x) => {
                  return (progress.progress ?? 0) * 100;
                }));
              },
              withCredentials: true
            });
            
            resolve({ data: res.data });
          }
          catch(error) {
            reject({ error });
          }
        })
      },
    }),
  }),
});

export const { useUploadMutation, useUploadProgressQuery } = uploadApiSlice;

import {
  IonContent,
  IonHeader,
  IonCard,
  IonButtons,
  IonBackButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonItem
} from "@ionic/react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { useEffect, useState, useRef } from "react";
import supabase from "../../superbaseClient";
import axios from "axios";

interface Post {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  featured_image_url?: string;
}

interface Category {
  id: number;
  name: string;
}

interface WordPressResponse {
  data: Post[];
  headers: {
    get(headerName: string): string | null;
  };
}

const BlogPage: React.FC = () => {
  const contentRef = useRef<HTMLIonContentElement | null>(null);
  const [articles, setArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<Record<number, string>>({});

  useEffect(() => {
    setLoading(true);
    contentRef.current?.scrollToTop(500);

    const fetchData = async () => {
      try {
        const timestamp = Date.now();
        // ✅ Correct WordPress API base URL
        const wordpressUrl = "https://kingdomlifestyleradio.com/wp/wp-json/wp/v2";

        const wordpressData: WordPressResponse = await axios.get(
          `${wordpressUrl}/posts?page=${page}&timestamp=${timestamp}`
        );

        const result: Post[] = wordpressData.data;
        const total = Number(wordpressData.headers.get("X-WP-Total") || "0");
        setTotalPages(Math.ceil(total / pageSize));

        const categoriesResponse = await axios.get<Category[]>(`${wordpressUrl}/categories`);
        const categoryMap: Record<number, string> = {};
        categoriesResponse.data.forEach((category: Category) => {
          categoryMap[category.id] = category.name;
        });
        setCategories(categoryMap);

        const postsWithImages: Post[] = await Promise.all(
          result.map(async (post: Post) => {
            if (post.featured_media) {
              const mediaResponse = await axios.get<{ source_url: string }>(
                `${wordpressUrl}/media/${post.featured_media}`
              );
              post.featured_image_url = mediaResponse.data.source_url;
            } else {
              post.featured_image_url = "";
            }
            return post;
          })
        );

        setArticles(postsWithImages);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, [page, pageSize]);

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
      contentRef.current?.scrollToTop(500);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
      contentRef.current?.scrollToTop(500);
    }
  };

  const doRefresh = async (event: any) => {
    try {
      window.location.reload();
      event.detail.complete();
    } catch (error) {
      event.detail.complete();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton />
          </IonButtons>
          <IonTitle>Articles</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef} fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">
              <div className="flex items-center gap-3">
                <img className="w-[70px]" src="/images/logo.png" alt="Logo" />
                <h1>Articles</h1>
              </div>
            </IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={doRefresh}>
          <IonRefresherContent
            className="custom-refresher-text !text-white"
            pullingIcon="chevron-down-circle-outline"
            pullingText="Pull to refresh"
            refreshingSpinner="circles"
            refreshingText="Refreshing..."
          />
        </IonRefresher>

        <div className="bg-white w-full min-h-[100%]">
          {loading && (
            <div className="h-[80vh] flex text-center p-3">
              <div className="w-[30%] m-auto max-w-[500px]">
                <img className="w-full" src="/images/loader.gif" alt="Loading..." />
              </div>
            </div>
          )}

          {!articles.length && !loading && (
            <div className="p-5 flex items-center min-h-[100%] text-center">
              <div>
                <div className="m-auto w-[200px] h-[200px]">
                  <img src="/images/connect.gif" alt="No Connection" />
                </div>
                <h1 className="font-extrabold text-2xl dark:text-black">
                  Can't get articles from database
                </h1>
                <p className="dark:text-black">
                  Make sure your internet connection is secure to access articles.
                </p>
              </div>
            </div>
          )}

          <div className="relative top-0 bg-[white]">
            {articles.length > 0 && !loading && (
              <div
                className="p-1 min-h-[50%] bg-[#002F3D] pb-[40px]"
                style={{ borderRadius: "0px 0px 70px 0px" }}
              >
                <div className="text-xs m-2 bg-[#C89700] w-max text-white p-1 rounded font-bold">
                  Latest
                </div>

                <Swiper slidesPerView={1.5} slidesPerGroup={1}>
                  {articles.slice(0, 4).map((ele: any, index: number) => (
                    <SwiperSlide
                      key={index}
                      className="flex flex-col justify-evenly items-center"
                      style={{ width: "100vw", height: "100%" }}
                    >
                      {/* ✅ Updated article link */}
                      <a
                        href={`https://kingdomlifestyleradio.com/wp/?p=${ele.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <IonCard className="relative text-black">
                          <div className="w-full flex overflow-hidden h-[100px]">
                            <img
                              className="w-full object-cover object-top"
                              src={ele.featured_image_url}
                              alt="Article"
                            />
                          </div>
                          <h1 className="!text-sm px-2 my-3 min-h-[50px] max-h-[100px] line-clamp-2 !font-bold">
                            <p
                              dangerouslySetInnerHTML={{
                                __html: ele.title.rendered,
                              }}
                            ></p>
                          </h1>
                          <h1 className="text-right p-2 text-purple-600">
                            <i className="fa-solid fa-arrow-circle-right text-xl text-yellow-500 font-extrabold"></i>
                          </h1>
                        </IonCard>
                      </a>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            )}

            <br />

            <IonList>
              {articles.length > 0 &&
                !loading &&
                articles.slice(2).map((ele: any, index: number) => (
                  <a
                    key={index}
                    href={`https://kingdomlifestyleradio.com/wp/?p=${ele.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IonItem>
                      <div className="m-2 p-2 w-full dark:text-[white]">
                        <div className="w-[100%] m-auto">
                          <img
                            className="w-full max-w-[500px]"
                            src={ele.featured_image_url}
                            alt="Post"
                          />
                        </div>
                        <h1
                          dangerouslySetInnerHTML={{
                            __html: ele.title.rendered,
                          }}
                          className="text-[#2d2a2a] my-2 font-extrabold text-lg dark:text-white"
                        ></h1>
                        <p
                          className="text-sm font-redhat text-justify font-semibold text-[#636262] line-clamp-3"
                          dangerouslySetInnerHTML={{
                            __html: ele.excerpt.rendered,
                          }}
                        ></p>
                      </div>
                    </IonItem>
                  </a>
                ))}
            </IonList>
          </div>
        </div>

        <div className="p-10 flex justify-between items-center">
          <button
            className={`${
              page === 1 ? "bg-purple-100 text-white" : "bg-blue-700"
            } p-2 rounded-md`}
            onClick={handlePreviousPage}
            disabled={page === 1}
          >
            <i className="fa fa-arrow-left"></i>
          </button>
          <span>
            {page} of {totalPages}
          </span>
          <button
            className={`${
              page === totalPages ? "bg-purple-100 text-white" : "bg-blue-700"
            } p-2 rounded-md`}
            onClick={handleNextPage}
          >
            <i className="fa fa-arrow-right"></i>
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default BlogPage;

/* <vietnam-activity-map> — bản đồ hoạt động sinh viên theo tỉnh, thành.
   Hình học: polygon đất liền Natural Earth 110m (world-atlas) chiếu bằng d3-geo.
   Dữ liệu: payload nạp từ thuộc tính src (bản thiết kế dùng fixture trong data/).
   Không viết cứng danh sách đơn vị, số liệu hay thứ tự — vẽ theo đúng payload.
   Thuộc tính: filter (slug chuyên mục) · src · height · demo (loading|empty|error|geo).
   Sự kiện phát ra: map-ready · map-error · province-select.
   Sự kiện nhận vào (document): hsv-map-select { detail: { slug } } — chọn từ danh sách ngoài. */
(function () {
  var TOPO = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  var NEIGHBOURS = { Laos: 1, Cambodia: 1, Thailand: 1, China: 1, Myanmar: 1, Malaysia: 1, Philippines: 1 };
  var VIEW_BBOX = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[101.6, 23.8], [117.6, 23.8], [117.6, 7.4], [101.6, 7.4], [101.6, 23.8]]] }
  };
  var FIXTURE_DATA = {
  "note": "34 đơn vị hành chính cấp tỉnh (sau sáp nhập 2025). Hoàng Sa và Trường Sa là hai quần đảo thuộc chủ quyền Việt Nam, hiển thị trên bản đồ mang tính chất minh họa — không phải đơn vị cấp tỉnh, không tính vào provinces_reported. Khối Hội Sinh viên Việt Nam ở ngoài nước được tính riêng, không nằm trong 34 đơn vị trong nước.",
  "updated_at": "2026-09-02T07:40:00+07:00",
  "summary": {
    "total_activities": 4214,
    "total_articles": 1470,
    "participating_students": 426510,
    "provinces_total": 34,
    "provinces_reported": 32,
    "period": "Tháng 8/2026"
  },
  "categories": [
    {
      "slug": "all",
      "label": "Tất cả"
    },
    {
      "slug": "sv5tot",
      "label": "Sinh viên 5 tốt"
    },
    {
      "slug": "tinhnguyen",
      "label": "Tình nguyện"
    },
    {
      "slug": "nckh",
      "label": "Nghiên cứu khoa học"
    },
    {
      "slug": "hoinhap",
      "label": "Hội nhập"
    }
  ],
  "archipelagos": [
    {
      "id": "hoang-sa",
      "name": "Quần đảo Hoàng Sa",
      "administered_by": "TP. Đà Nẵng",
      "lat": 16.5,
      "lon": 112,
      "islet_offsets": [
        [
          0,
          0
        ],
        [
          0.55,
          0.5
        ],
        [
          -0.5,
          0.62
        ],
        [
          0.35,
          -0.55
        ],
        [
          -0.45,
          -0.35
        ]
      ],
      "illustrative": true
    },
    {
      "id": "truong-sa",
      "name": "Quần đảo Trường Sa",
      "administered_by": "Tỉnh Khánh Hoà",
      "lat": 9.6,
      "lon": 113.2,
      "islet_offsets": [
        [
          0,
          0
        ],
        [
          0.7,
          0.85
        ],
        [
          -0.6,
          0.7
        ],
        [
          0.5,
          -0.8
        ],
        [
          -0.75,
          -0.5
        ],
        [
          1.1,
          -0.1
        ],
        [
          -0.15,
          1.25
        ]
      ],
      "illustrative": true
    }
  ],
  "provinces": [
    {
      "province_id": "01",
      "province_name": "Hà Nội",
      "slug": "ha-noi",
      "lat": 21.028,
      "lon": 105.854,
      "activity_count": 412,
      "article_count": 188,
      "unit_count": 62,
      "latest_article": {
        "title": "Đại hội đại biểu toàn quốc lần thứ XII khai mạc tại Hà Nội",
        "published_at": "02.09.2026"
      },
      "category_distribution": {
        "sv5tot": 118,
        "tinhnguyen": 142,
        "nckh": 96,
        "hoinhap": 56
      },
      "student_count": 49160,
      "reported": true,
      "unit_url": "/don-vi/ha-noi",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "79",
      "province_name": "TP. Hồ Chí Minh",
      "slug": "tp-ho-chi-minh",
      "lat": 10.776,
      "lon": 106.7,
      "activity_count": 486,
      "article_count": 214,
      "unit_count": 74,
      "latest_article": {
        "title": "Ngày hội “Sinh viên với chuyển đổi số” 2026 mở đăng ký",
        "published_at": "02.09.2026"
      },
      "category_distribution": {
        "sv5tot": 136,
        "tinhnguyen": 168,
        "nckh": 118,
        "hoinhap": 64
      },
      "student_count": 58540,
      "reported": true,
      "unit_url": "/don-vi/tp-ho-chi-minh",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "48",
      "province_name": "Đà Nẵng",
      "slug": "da-nang",
      "lat": 16.047,
      "lon": 108.206,
      "activity_count": 268,
      "article_count": 96,
      "unit_count": 29,
      "latest_article": {
        "title": "Tập huấn cán bộ Hội cấp trường khu vực miền Trung",
        "published_at": "02.09.2026"
      },
      "category_distribution": {
        "sv5tot": 71,
        "tinhnguyen": 88,
        "nckh": 74,
        "hoinhap": 35
      },
      "student_count": 24720,
      "reported": true,
      "unit_url": "/don-vi/da-nang",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "31",
      "province_name": "Hải Phòng",
      "slug": "hai-phong",
      "lat": 20.865,
      "lon": 106.684,
      "activity_count": 168,
      "article_count": 54,
      "unit_count": 19,
      "latest_article": {
        "title": "Sinh viên Hàng hải khảo sát chất lượng nước ven bờ Đồ Sơn",
        "published_at": "31.08.2026"
      },
      "category_distribution": {
        "sv5tot": 38,
        "tinhnguyen": 72,
        "nckh": 43,
        "hoinhap": 15
      },
      "student_count": 16020,
      "reported": true,
      "unit_url": "/don-vi/hai-phong",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "46",
      "province_name": "Huế",
      "slug": "hue",
      "lat": 16.463,
      "lon": 107.59,
      "activity_count": 156,
      "article_count": 58,
      "unit_count": 18,
      "latest_article": {
        "title": "Nhóm sinh viên số hoá 4.000 trang tư liệu Hán Nôm",
        "published_at": "01.09.2026"
      },
      "category_distribution": {
        "sv5tot": 38,
        "tinhnguyen": 52,
        "nckh": 51,
        "hoinhap": 15
      },
      "student_count": 15110,
      "reported": true,
      "unit_url": "/don-vi/hue",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "92",
      "province_name": "Cần Thơ",
      "slug": "can-tho",
      "lat": 10.034,
      "lon": 105.786,
      "activity_count": 214,
      "article_count": 76,
      "unit_count": 26,
      "latest_article": {
        "title": "Mô hình quan trắc mặn do sinh viên tự chế tạo",
        "published_at": "01.09.2026"
      },
      "category_distribution": {
        "sv5tot": 54,
        "tinhnguyen": 84,
        "nckh": 58,
        "hoinhap": 18
      },
      "student_count": 21560,
      "reported": true,
      "unit_url": "/don-vi/can-tho",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "08",
      "province_name": "Tuyên Quang",
      "slug": "tuyen-quang",
      "lat": 21.823,
      "lon": 105.214,
      "activity_count": 74,
      "article_count": 24,
      "unit_count": 9,
      "latest_article": {
        "title": "Hành trình “Theo dấu chân lịch sử” của sinh viên vùng Việt Bắc",
        "published_at": "29.08.2026"
      },
      "category_distribution": {
        "sv5tot": 16,
        "tinhnguyen": 38,
        "nckh": 15,
        "hoinhap": 5
      },
      "student_count": 7460,
      "reported": true,
      "unit_url": "/don-vi/tuyen-quang",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "04",
      "province_name": "Cao Bằng",
      "slug": "cao-bang",
      "lat": 22.666,
      "lon": 106.258,
      "activity_count": null,
      "article_count": null,
      "unit_count": null,
      "latest_article": null,
      "category_distribution": null,
      "student_count": null,
      "reported": false,
      "unit_url": "/don-vi/cao-bang",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "12",
      "province_name": "Lai Châu",
      "slug": "lai-chau",
      "lat": 22.396,
      "lon": 103.459,
      "activity_count": 43,
      "article_count": 13,
      "unit_count": 5,
      "latest_article": {
        "title": "Đội hình sửa chữa điện dân dụng tại các xã vùng cao",
        "published_at": "26.08.2026"
      },
      "category_distribution": {
        "sv5tot": 6,
        "tinhnguyen": 28,
        "nckh": 7
      },
      "student_count": 4190,
      "reported": true,
      "unit_url": "/don-vi/lai-chau",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "10",
      "province_name": "Lào Cai",
      "slug": "lao-cai",
      "lat": 22.485,
      "lon": 103.975,
      "activity_count": 76,
      "article_count": 25,
      "unit_count": 8,
      "latest_article": {
        "title": "Lớp tiếng Việt hè cho học sinh vùng cao Bát Xát",
        "published_at": "27.08.2026"
      },
      "category_distribution": {
        "sv5tot": 13,
        "tinhnguyen": 45,
        "nckh": 13,
        "hoinhap": 5
      },
      "student_count": 6870,
      "reported": true,
      "unit_url": "/don-vi/lao-cai",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "19",
      "province_name": "Thái Nguyên",
      "slug": "thai-nguyen",
      "lat": 21.594,
      "lon": 105.848,
      "activity_count": 187,
      "article_count": 58,
      "unit_count": 22,
      "latest_article": {
        "title": "Ngày hội hiến máu “Chủ nhật đỏ” của sinh viên vùng Việt Bắc",
        "published_at": "30.08.2026"
      },
      "category_distribution": {
        "sv5tot": 52,
        "tinhnguyen": 78,
        "nckh": 41,
        "hoinhap": 16
      },
      "student_count": 18380,
      "reported": true,
      "unit_url": "/don-vi/thai-nguyen",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "11",
      "province_name": "Điện Biên",
      "slug": "dien-bien",
      "lat": 21.386,
      "lon": 103.017,
      "activity_count": 62,
      "article_count": 24,
      "unit_count": 7,
      "latest_article": {
        "title": "Bàn giao 12 điểm trường tại Điện Biên trước năm học mới",
        "published_at": "31.08.2026"
      },
      "category_distribution": {
        "sv5tot": 9,
        "tinhnguyen": 42,
        "nckh": 8
      },
      "student_count": 5910,
      "reported": true,
      "unit_url": "/don-vi/dien-bien",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "20",
      "province_name": "Lạng Sơn",
      "slug": "lang-son",
      "lat": 21.853,
      "lon": 106.761,
      "activity_count": 57,
      "article_count": 18,
      "unit_count": 7,
      "latest_article": {
        "title": "Sinh viên hỗ trợ số hoá thủ tục cho hộ kinh doanh vùng biên",
        "published_at": "28.08.2026"
      },
      "category_distribution": {
        "sv5tot": 11,
        "tinhnguyen": 30,
        "nckh": 12,
        "hoinhap": 4
      },
      "student_count": 5790,
      "reported": true,
      "unit_url": "/don-vi/lang-son",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "14",
      "province_name": "Sơn La",
      "slug": "son-la",
      "lat": 21.327,
      "lon": 103.914,
      "activity_count": 68,
      "article_count": 21,
      "unit_count": 8,
      "latest_article": {
        "title": "Đội hình nông nghiệp sinh viên hỗ trợ vùng trồng cây ăn quả",
        "published_at": "29.08.2026"
      },
      "category_distribution": {
        "sv5tot": 12,
        "tinhnguyen": 38,
        "nckh": 14
      },
      "student_count": 6680,
      "reported": true,
      "unit_url": "/don-vi/son-la",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "25",
      "province_name": "Phú Thọ",
      "slug": "phu-tho",
      "lat": 21.323,
      "lon": 105.402,
      "activity_count": 112,
      "article_count": 34,
      "unit_count": 13,
      "latest_article": {
        "title": "Chương trình “Tiếp sức mùa thi” mở rộng tại vùng trung du",
        "published_at": "30.08.2026"
      },
      "category_distribution": {
        "sv5tot": 26,
        "tinhnguyen": 54,
        "nckh": 22,
        "hoinhap": 10
      },
      "student_count": 10900,
      "reported": true,
      "unit_url": "/don-vi/phu-tho",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "27",
      "province_name": "Bắc Ninh",
      "slug": "bac-ninh",
      "lat": 21.186,
      "lon": 106.076,
      "activity_count": 124,
      "article_count": 39,
      "unit_count": 15,
      "latest_article": {
        "title": "Sinh viên kỹ thuật thực tập tại các nhà máy công nghệ cao",
        "published_at": "01.09.2026"
      },
      "category_distribution": {
        "sv5tot": 31,
        "tinhnguyen": 48,
        "nckh": 33,
        "hoinhap": 12
      },
      "student_count": 12450,
      "reported": true,
      "unit_url": "/don-vi/bac-ninh",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "22",
      "province_name": "Quảng Ninh",
      "slug": "quang-ninh",
      "lat": 20.971,
      "lon": 107.043,
      "activity_count": 98,
      "article_count": 31,
      "unit_count": 11,
      "latest_article": {
        "title": "Đội hình sinh viên số hoá tư liệu di sản vùng vịnh",
        "published_at": "29.08.2026"
      },
      "category_distribution": {
        "sv5tot": 21,
        "tinhnguyen": 44,
        "nckh": 24,
        "hoinhap": 9
      },
      "student_count": 9290,
      "reported": true,
      "unit_url": "/don-vi/quang-ninh",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "33",
      "province_name": "Hưng Yên",
      "slug": "hung-yen",
      "lat": 20.646,
      "lon": 106.051,
      "activity_count": 86,
      "article_count": 26,
      "unit_count": 10,
      "latest_article": {
        "title": "Ngày hội việc làm sinh viên khu vực đồng bằng sông Hồng",
        "published_at": "28.08.2026"
      },
      "category_distribution": {
        "sv5tot": 22,
        "tinhnguyen": 36,
        "nckh": 20,
        "hoinhap": 8
      },
      "student_count": 8380,
      "reported": true,
      "unit_url": "/don-vi/hung-yen",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "37",
      "province_name": "Ninh Bình",
      "slug": "ninh-binh",
      "lat": 20.25,
      "lon": 105.974,
      "activity_count": 94,
      "article_count": 29,
      "unit_count": 11,
      "latest_article": {
        "title": "Sinh viên hướng dẫn viên tình nguyện tại khu di sản",
        "published_at": "27.08.2026"
      },
      "category_distribution": {
        "sv5tot": 21,
        "tinhnguyen": 42,
        "nckh": 22,
        "hoinhap": 9
      },
      "student_count": 9200,
      "reported": true,
      "unit_url": "/don-vi/ninh-binh",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "38",
      "province_name": "Thanh Hoá",
      "slug": "thanh-hoa",
      "lat": 19.807,
      "lon": 105.776,
      "activity_count": 121,
      "article_count": 36,
      "unit_count": 13,
      "latest_article": {
        "title": "Tiếp sức mùa thi tại 27 điểm thi khu vực Bắc Trung Bộ",
        "published_at": "26.08.2026"
      },
      "category_distribution": {
        "sv5tot": 26,
        "tinhnguyen": 61,
        "nckh": 24,
        "hoinhap": 10
      },
      "student_count": 11100,
      "reported": true,
      "unit_url": "/don-vi/thanh-hoa",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "40",
      "province_name": "Nghệ An",
      "slug": "nghe-an",
      "lat": 18.679,
      "lon": 105.681,
      "activity_count": 137,
      "article_count": 45,
      "unit_count": 15,
      "latest_article": {
        "title": "Sinh viên Vinh xây dựng bản đồ ngập lụt cộng đồng",
        "published_at": "29.08.2026"
      },
      "category_distribution": {
        "sv5tot": 32,
        "tinhnguyen": 63,
        "nckh": 31,
        "hoinhap": 11
      },
      "student_count": 12750,
      "reported": true,
      "unit_url": "/don-vi/nghe-an",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "42",
      "province_name": "Hà Tĩnh",
      "slug": "ha-tinh",
      "lat": 18.343,
      "lon": 105.906,
      "activity_count": 79,
      "article_count": 24,
      "unit_count": 9,
      "latest_article": {
        "title": "Đội hình phòng chống thiên tai của sinh viên trước mùa mưa bão",
        "published_at": "28.08.2026"
      },
      "category_distribution": {
        "sv5tot": 17,
        "tinhnguyen": 42,
        "nckh": 15,
        "hoinhap": 5
      },
      "student_count": 7580,
      "reported": true,
      "unit_url": "/don-vi/ha-tinh",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "45",
      "province_name": "Quảng Trị",
      "slug": "quang-tri",
      "lat": 17.468,
      "lon": 106.622,
      "activity_count": 88,
      "article_count": 27,
      "unit_count": 10,
      "latest_article": {
        "title": "Hành trình tri ân tại các nghĩa trang liệt sĩ của sinh viên",
        "published_at": "31.08.2026"
      },
      "category_distribution": {
        "sv5tot": 19,
        "tinhnguyen": 47,
        "nckh": 16,
        "hoinhap": 6
      },
      "student_count": 8420,
      "reported": true,
      "unit_url": "/don-vi/quang-tri",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "51",
      "province_name": "Quảng Ngãi",
      "slug": "quang-ngai",
      "lat": 15.12,
      "lon": 108.792,
      "activity_count": 84,
      "article_count": 26,
      "unit_count": 9,
      "latest_article": {
        "title": "Sinh viên kiến trúc đo vẽ nhà cổ và làng biển",
        "published_at": "25.08.2026"
      },
      "category_distribution": {
        "sv5tot": 18,
        "tinhnguyen": 40,
        "nckh": 20,
        "hoinhap": 6
      },
      "student_count": 7690,
      "reported": true,
      "unit_url": "/don-vi/quang-ngai",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "52",
      "province_name": "Gia Lai",
      "slug": "gia-lai",
      "lat": 13.782,
      "lon": 109.219,
      "activity_count": 116,
      "article_count": 36,
      "unit_count": 13,
      "latest_article": {
        "title": "Ngày hội khởi nghiệp sinh viên Nam Trung Bộ",
        "published_at": "28.08.2026"
      },
      "category_distribution": {
        "sv5tot": 28,
        "tinhnguyen": 49,
        "nckh": 29,
        "hoinhap": 10
      },
      "student_count": 10990,
      "reported": true,
      "unit_url": "/don-vi/gia-lai",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "56",
      "province_name": "Khánh Hoà",
      "slug": "khanh-hoa",
      "lat": 12.238,
      "lon": 109.196,
      "activity_count": 134,
      "article_count": 44,
      "unit_count": 15,
      "latest_article": {
        "title": "Chiến dịch làm sạch bờ biển Nha Trang mùa cao điểm",
        "published_at": "30.08.2026"
      },
      "category_distribution": {
        "sv5tot": 31,
        "tinhnguyen": 63,
        "nckh": 28,
        "hoinhap": 12
      },
      "student_count": 12680,
      "reported": true,
      "unit_url": "/don-vi/khanh-hoa",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "68",
      "province_name": "Lâm Đồng",
      "slug": "lam-dong",
      "lat": 11.94,
      "lon": 108.442,
      "activity_count": 108,
      "article_count": 33,
      "unit_count": 12,
      "latest_article": {
        "title": "Sinh viên Đà Lạt khảo sát rừng thông cùng kiểm lâm",
        "published_at": "24.08.2026"
      },
      "category_distribution": {
        "sv5tot": 24,
        "tinhnguyen": 47,
        "nckh": 28,
        "hoinhap": 9
      },
      "student_count": 10160,
      "reported": true,
      "unit_url": "/don-vi/lam-dong",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "66",
      "province_name": "Đắk Lắk",
      "slug": "dak-lak",
      "lat": 12.68,
      "lon": 108.05,
      "activity_count": 96,
      "article_count": 29,
      "unit_count": 11,
      "latest_article": {
        "title": "Đội hình chuyển đổi số hỗ trợ hợp tác xã cà phê",
        "published_at": "27.08.2026"
      },
      "category_distribution": {
        "sv5tot": 21,
        "tinhnguyen": 45,
        "nckh": 23,
        "hoinhap": 7
      },
      "student_count": 9250,
      "reported": true,
      "unit_url": "/don-vi/dak-lak",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "75",
      "province_name": "Đồng Nai",
      "slug": "dong-nai",
      "lat": 10.95,
      "lon": 106.822,
      "activity_count": 142,
      "article_count": 44,
      "unit_count": 17,
      "latest_article": {
        "title": "Sinh viên hỗ trợ công nhân trẻ học tiếng Anh buổi tối",
        "published_at": "26.08.2026"
      },
      "category_distribution": {
        "sv5tot": 34,
        "tinhnguyen": 64,
        "nckh": 32,
        "hoinhap": 12
      },
      "student_count": 14150,
      "reported": true,
      "unit_url": "/don-vi/dong-nai",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "72",
      "province_name": "Tây Ninh",
      "slug": "tay-ninh",
      "lat": 11.31,
      "lon": 106.098,
      "activity_count": 72,
      "article_count": 22,
      "unit_count": 8,
      "latest_article": {
        "title": "Lớp học biên giới của sinh viên tình nguyện",
        "published_at": "25.08.2026"
      },
      "category_distribution": {
        "sv5tot": 14,
        "tinhnguyen": 40,
        "hoinhap": 5
      },
      "student_count": 6780,
      "reported": true,
      "unit_url": "/don-vi/tay-ninh",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "86",
      "province_name": "Vĩnh Long",
      "slug": "vinh-long",
      "lat": 10.253,
      "lon": 105.972,
      "activity_count": 81,
      "article_count": 25,
      "unit_count": 9,
      "latest_article": {
        "title": "Sinh viên hỗ trợ nông dân đăng ký mã vùng trồng",
        "published_at": "26.08.2026"
      },
      "category_distribution": {
        "sv5tot": 18,
        "tinhnguyen": 39,
        "nckh": 18,
        "hoinhap": 6
      },
      "student_count": 7620,
      "reported": true,
      "unit_url": "/don-vi/vinh-long",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "87",
      "province_name": "Đồng Tháp",
      "slug": "dong-thap",
      "lat": 10.459,
      "lon": 105.637,
      "activity_count": 77,
      "article_count": 23,
      "unit_count": 9,
      "latest_article": {
        "title": "Mô hình lọc nước cho trường học vùng ngập của sinh viên",
        "published_at": "24.08.2026"
      },
      "category_distribution": {
        "sv5tot": 16,
        "tinhnguyen": 38,
        "hoinhap": 6
      },
      "student_count": 7530,
      "reported": true,
      "unit_url": "/don-vi/dong-thap",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "91",
      "province_name": "An Giang",
      "slug": "an-giang",
      "lat": 10.012,
      "lon": 105.081,
      "activity_count": 94,
      "article_count": 28,
      "unit_count": 11,
      "latest_article": {
        "title": "Đội hình sinh viên khảo sát rác thải nhựa đảo Phú Quốc",
        "published_at": "23.08.2026"
      },
      "category_distribution": {
        "sv5tot": 19,
        "tinhnguyen": 50,
        "nckh": 18,
        "hoinhap": 7
      },
      "student_count": 9200,
      "reported": true,
      "unit_url": "/don-vi/an-giang",
      "period": "Tháng 8/2026"
    },
    {
      "province_id": "96",
      "province_name": "Cà Mau",
      "slug": "ca-mau",
      "lat": 9.177,
      "lon": 105.15,
      "activity_count": null,
      "article_count": null,
      "unit_count": null,
      "latest_article": null,
      "category_distribution": null,
      "student_count": null,
      "reported": false,
      "unit_url": "/don-vi/ca-mau",
      "period": "Tháng 8/2026"
    }
  ],
  "overseas": {
    "label": "Hội Sinh viên Việt Nam ở ngoài nước",
    "countries": [
      {
        "name": "Hội Sinh viên Việt Nam tại Australia",
        "activity_count": 148
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Pháp",
        "activity_count": 132
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Singapore",
        "activity_count": 96
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Thái Lan",
        "activity_count": 88
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Italia",
        "activity_count": 54
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Hàn Quốc",
        "activity_count": 126
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Bỉ",
        "activity_count": 47
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Hungary",
        "activity_count": 41
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Đức",
        "activity_count": 118
      },
      {
        "name": "Hội Sinh viên Việt Nam tại New Zealand",
        "activity_count": 52
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Vương quốc Anh",
        "activity_count": 112
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Hà Lan",
        "activity_count": 63
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Áo",
        "activity_count": 38
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Liên bang Nga",
        "activity_count": 104
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Ireland",
        "activity_count": 29
      },
      {
        "name": "Hội Sinh viên Việt Nam tại Ấn Độ",
        "activity_count": 34
      }
    ],
    "note": "Khối ngoài nước — tính riêng, không thuộc 34 đơn vị trong nước."
  },
  "source": "Dữ liệu mẫu (fixture) dùng cho bản thiết kế. API thật chưa được kết nối.",
  "planned_endpoint": "GET /api/v1/activity-map?category=<slug>",
  "geometry_source": {
    "name": "Natural Earth 110m qua world-atlas 2.0.2 (topojson)",
    "unit_codes": "Mã tỉnh, thành theo danh mục hành chính 2025 — CẦN KIỂM CHỨNG với danh mục chính thức",
    "verified": false
  },
  "reporting_period": {
    "label": "Tháng 8/2026",
    "from": "2026-08-01",
    "to": "2026-08-31"
  }
};
  var SVGNS = "http://www.w3.org/2000/svg";
  var _topoCache = null;

  function el(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function libsReady() {
    return new Promise(function (res, rej) {
      var t0 = Date.now();
      (function tick() {
        if (window.d3 && window.topojson) return res();
        if (Date.now() - t0 > 20000) return rej(new Error("d3/topojson"));
        setTimeout(tick, 60);
      })();
    });
  }
  function reduced() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function nfm(n) { return Number(n).toLocaleString("vi-VN"); }

  class VietnamActivityMap extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._filter = "all";
      this._selected = null;
      this._state = "loading";
      this._demo = "";
      this._gOpen = false;
      this._ovSel = null;
    }
    static get observedAttributes() { return ["filter", "src", "height", "demo"]; }

    attributeChangedCallback(name, _o, v) {
      if (name === "filter") { this._filter = v || "all"; this.paint(); }
      if (name === "demo") { this._demo = v || ""; this.paint(); }
      if (name === "src" && this.isConnected) this.load();
    }
    set filter(v) { this.setAttribute("filter", v); }
    get filter() { return this._filter; }
    get data() { return this._data; }
    get selected() { return this._selected; }

    /* Trạng thái hiệu dụng: demo (để kiểm tra thiết kế) ưu tiên hơn trạng thái nạp thật. */
    get view() {
      if (this._demo === "loading" || this._demo === "empty" || this._demo === "error" || this._demo === "geo") return this._demo;
      return this._state;
    }

    connectedCallback() {
      this.shadowRoot.innerHTML =
        '<style>' +
        ':host{display:block;position:relative;font-family:var(--font-ui,system-ui)}' +
        '.stage{position:relative;margin:0 auto}' +
        'svg{display:block;overflow:hidden}' +
        '.p{cursor:pointer;outline:none}' +
        '.p circle.hit{fill:transparent}' +
        '.p circle.dot{transition:r var(--dur-base,280ms) var(--ease-standard,ease),fill-opacity var(--dur-base,280ms) var(--ease-standard,ease)}' +
        '.p:hover circle.dot,.p:focus-visible circle.dot{fill-opacity:1}' +
        '.p:focus-visible circle.ring{stroke:var(--focus-ring,#3f92db);stroke-width:2.5;opacity:1}' +
        '.tip{position:absolute;z-index:5;min-width:212px;max-width:258px;padding:13px 15px;border-radius:var(--radius-md,12px);background:var(--white,#fff);border:1px solid var(--border-subtle,#e6eaef);box-shadow:var(--shadow-lg,0 18px 40px rgba(4,22,43,.16));pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity 140ms ease,transform 140ms ease}' +
        '.tip.on{opacity:1;transform:none}' +
        '.tip h4{margin:0 0 8px;font-family:var(--font-mono,monospace);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--brand-primary,#0b5fa5)}' +
        '.tip .n{display:flex;gap:16px}' +
        '.tip .n b{display:block;font-family:var(--font-editorial,serif);font-size:21px;font-weight:500;color:var(--text-strong,#0a0d12);line-height:1}' +
        '.tip .n span{font-size:11.5px;color:var(--text-muted,#647081)}' +
        '.tip .none{font-size:12.5px;line-height:1.5;color:var(--text-muted,#647081)}' +
        '.tip p{margin:9px 0 0;padding-top:9px;border-top:1px solid var(--border-subtle,#e6eaef);font-size:12.5px;line-height:1.5;color:var(--text-body,#1d232c)}' +
        '.tip em{display:block;font-style:normal;font-family:var(--font-mono,monospace);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint,#8d97a5);margin-bottom:4px}' +
        '.arch text{font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:.08em;text-transform:uppercase;fill:var(--text-muted,#647081)}' +
        '.arch text.sub{font-size:7.5px;letter-spacing:.06em;fill:var(--text-faint,#8d97a5);text-transform:none}' +
        '.globe{cursor:pointer;outline:none}' +
        '.globe circle.sphere{transition:fill-opacity var(--dur-base,280ms) ease}' +
        '.globe:hover circle.sphere,.globe:focus-visible circle.sphere{fill-opacity:.16}' +
        '.globe.sel circle.sphere{fill-opacity:.2;stroke-width:2.2}' +
        '.globe.open circle.sphere{fill-opacity:.16}' +
        '.globe:focus-visible circle.sphere{stroke:var(--focus-ring,#3f92db);stroke-width:2.5}' +
        '.globe text{font-family:var(--font-mono,monospace);font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;fill:var(--text-muted,#647081)}' +
        '.gpanel{position:absolute;z-index:6;width:290px;box-sizing:border-box;padding:14px 15px;border-radius:var(--radius-md,12px);background:var(--white,#fff);border:1px solid var(--border-subtle,#e6eaef);box-shadow:var(--shadow-lg,0 18px 40px rgba(4,22,43,.16));pointer-events:none;overflow:auto;opacity:0;transform:translateY(4px);transition:opacity 140ms ease,transform 140ms ease}' +
        '.gpanel.on{opacity:1;transform:none}' +
        '.gpanel.pinned{pointer-events:auto}' +
        '.gpanel .head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}' +
        '.gpanel .x{flex:0 0 auto;width:26px;height:26px;display:none;place-items:center;border-radius:999px;border:1px solid var(--border-default,#d9dee5);background:transparent;color:var(--text-muted,#647081);cursor:pointer;padding:0}' +
        '.gpanel.pinned .x{display:grid}' +
        '.gpanel .x:hover{border-color:var(--border-brand,#0b5fa5);color:var(--brand-primary,#0b5fa5)}' +
        '.gpanel li>button{display:block;width:100%;padding:5px 7px;margin:0 -7px;border:0;border-radius:8px;background:transparent;font:inherit;text-align:left;cursor:pointer;color:inherit}' +
        '.gpanel.pinned li>button:hover{background:var(--blue-50,#f0f6fd)}' +
        '.gpanel li>button[aria-pressed="true"]{background:var(--blue-50,#f0f6fd)}' +
        '.gpanel li>button[aria-pressed="true"] span{color:var(--brand-primary,#0b5fa5);font-weight:600}' +
        '.gpanel li>button:focus-visible{outline:2px solid var(--focus-ring,#3f92db);outline-offset:1px}' +
        '.gpanel .hint{margin:10px 0 0;padding-top:9px;border-top:1px solid var(--border-subtle,#e6eaef);font-size:11.5px;line-height:1.5;color:var(--text-faint,#8d97a5)}' +
        '.gpanel h4{margin:0 0 3px;font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--brand-primary,#0b5fa5)}' +
        '.gpanel .sub{margin:0 0 10px;font-family:var(--font-mono,monospace);font-size:9.5px;color:var(--text-faint,#8d97a5)}' +
        '.gpanel ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}' +
        '.gpanel li>span{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;line-height:1.25;color:var(--text-body,#1d232c)}' +
        '.gpanel li>span b{font-family:var(--font-mono,monospace);font-weight:500;color:var(--text-muted,#647081)}' +
        '.gpanel .bar{margin-top:3px;height:4px;border-radius:999px;background:var(--ink-100,#f0f2f6);overflow:hidden}' +
        '.gpanel .bar i{display:block;height:100%;border-radius:999px;background:var(--blue-600,#0b5fa5)}' +
        '.lbl{font-family:var(--font-mono,monospace);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint,#8d97a5)}' +
        '.legend{display:flex;align-items:flex-end;gap:22px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-subtle,#e6eaef)}' +
        '.legend .sizes{display:flex;align-items:flex-end;gap:12px}' +
        '.legend .sizes div{display:flex;flex-direction:column;align-items:center;gap:6px;font-family:var(--font-mono,monospace);font-size:10.5px;color:var(--text-muted,#647081)}' +
        '.legend .sizes b{display:block;border-radius:999px;background:var(--blue-500,#1272c2);opacity:.55}' +
        '.legend .none{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted,#647081)}' +
        '.legend .none i{width:13px;height:13px;border-radius:999px;border:1.4px dashed var(--ink-400,#8d97a5);background:transparent}' +
        '.msg{display:flex;flex-direction:column;gap:12px;align-items:flex-start;padding:28px;border:1px dashed var(--border-default,#d9dee5);border-radius:var(--radius-lg,16px);background:var(--surface-subtle,#f7f8fa);min-height:320px;justify-content:center;width:100%;box-sizing:border-box}' +
        '.msg p{margin:0;font-size:14px;line-height:1.6;color:var(--text-muted,#647081);max-width:48ch}' +
        '.msg button{height:40px;padding:0 18px;border-radius:999px;border:1px solid var(--border-brand,#0b5fa5);background:transparent;color:var(--brand-primary,#0b5fa5);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}' +
        '.sk{width:100%;border-radius:var(--radius-lg,16px);background:linear-gradient(90deg,var(--ink-100,#f0f2f6) 25%,var(--ink-150,#e6eaef) 37%,var(--ink-100,#f0f2f6) 63%);background-size:280% 100%;animation:sh 1.4s linear infinite}' +
        '@keyframes sh{0%{background-position:-180% 0}100%{background-position:180% 0}}' +
        '@media (prefers-reduced-motion: reduce){.sk{animation:none}.p circle.dot{transition:none}}' +
        '</style><div class="host"></div>';
      this._host = this.shadowRoot.querySelector(".host");
      this.load();
      this._onExt = (e) => {
        var s = e.detail ? e.detail.slug : null;
        if (!s) this.clearOverseas(false);
        this.setSelected(s || null);
      };
      document.addEventListener("hsv-map-select", this._onExt);
      this._lastW = this.clientWidth;
      this._ro = new ResizeObserver(() => {
        var w = this.clientWidth;
        if (Math.abs(w - this._lastW) < 8) return;
        this._lastW = w;
        clearTimeout(this._rt);
        this._rt = setTimeout(() => this.paint(), 140);
      });
      this._ro.observe(this);
    }
    disconnectedCallback() {
      if (this._ro) this._ro.disconnect();
      if (this._gDoc) document.removeEventListener("click", this._gDoc, true);
      if (this._gKey) document.removeEventListener("keydown", this._gKey);
      document.removeEventListener("hsv-map-select", this._onExt);
    }

    async load() {
      this._state = "loading";
      this.paint();
      try {
        await libsReady();
        /* Nạp số liệu trước: nếu nền địa lý lỗi, danh sách đơn vị của trang vẫn dùng được. */
        var src = this.getAttribute("src") || "data/activity-map.sample.json";
        try {
          var dr = await fetch(src);
          if (!dr.ok) throw new Error("data");
          this._data = await dr.json();
        } catch (fe) {
          /* Tệp HTML xuất ra (mở trực tiếp bằng file://) không thể fetch tệp JSON tương đối — dùng dữ liệu mẫu nhúng sẵn. */
          this._data = FIXTURE_DATA;
        }
        this.dispatchEvent(new CustomEvent("map-ready", { detail: this._data, bubbles: true, composed: true }));
        if (!_topoCache) {
          var tr = await fetch(TOPO);
          if (!tr.ok) throw new Error("geo");
          _topoCache = await tr.json();
        }
        var land = window.topojson.feature(_topoCache, _topoCache.objects.countries).features;
        this._vn = land.find(function (f) { return String(f.id) === "704" || /viet\s?nam/i.test(f.properties.name || ""); });
        this._near = land.filter(function (f) { return NEIGHBOURS[f.properties.name]; });
        if (!this._vn) throw new Error("geo");
        this._state = (this._data.provinces || []).length ? "loaded" : "empty";
      } catch (e) {
        this._state = e.message === "geo" ? "geo" : "error";
        this.dispatchEvent(new CustomEvent("map-error", { detail: this._state, bubbles: true, composed: true }));
      }
      this.paint();
    }

    /* null = chưa có số liệu (chưa báo cáo, hoặc chuyên mục không có dữ liệu). Khác 0. */
    value(p) {
      if (p.reported === false) return null;
      if (this._filter && this._filter !== "all") {
        var d = p.category_distribution;
        if (!d || d[this._filter] == null) return null;
        return d[this._filter];
      }
      return p.activity_count == null ? null : p.activity_count;
    }

    aspect() {
      if (this._aspect) return this._aspect;
      var p = window.d3.geoMercator().fitExtent([[0, 0], [1000, 100000]], VIEW_BBOX);
      var a = p([101.6, 23.8]), b = p([117.6, 7.4]);
      this._aspect = Math.abs(b[0] - a[0]) / Math.abs(b[1] - a[1]);
      return this._aspect;
    }

    /* Khung bản đồ luôn nằm trong bề rộng host (1280–1920px đều không tràn). */
    dims() {
      var ar = this.aspect();
      var hostW = this.clientWidth || 640;
      var forced = +(this.getAttribute("height") || 0);
      var maxH = forced || 620;
      var W = Math.max(240, hostW);
      var H = Math.round(W / ar);
      if (H > maxH) { H = maxH; W = Math.min(Math.round(H * ar), hostW); }
      return { W: Math.round(W), H: Math.round(H) };
    }

    paint() {
      if (!this._host) return;
      var view = this.view;
      var dim = window.d3 ? this.dims() : { W: 480, H: 500 };

      if (view === "loading") {
        this._host.innerHTML =
          '<div class="sk" style="height:' + dim.H + 'px"></div>' +
          '<div class="legend"><div class="sk" style="height:14px;width:180px"></div></div>';
        return;
      }
      if (view === "error" || view === "empty" || view === "geo") {
        var head = view === "empty" ? "Chưa có dữ liệu hoạt động"
          : view === "geo" ? "Chưa hiển thị được nền bản đồ" : "Chưa tải được số liệu bản đồ";
        var body = view === "empty"
          ? "Kỳ thống kê này chưa có đơn vị nào gửi số liệu. Bạn vẫn có thể mở danh sách tỉnh, thành ở dưới để xem từng đơn vị."
          : view === "geo"
            ? "Bản đồ cần nền địa lý để vẽ. Bạn có thể thử lại, hoặc mở danh sách tỉnh, thành ở dưới để xem hoạt động từng đơn vị."
            : "Số liệu hoạt động tạm thời chưa tải được. Bạn có thể thử lại, hoặc mở danh sách tỉnh, thành ở dưới để xem hoạt động từng đơn vị.";
        this._host.innerHTML =
          '<div class="msg"><span class="lbl" style="color:' +
          (view === "empty" ? "var(--text-faint)" : "var(--status-warning,#e0910f)") + '">' + head + '</span><p>' + body + '</p>' +
          (view === "empty" ? "" : '<button type="button">Thử lại</button>') + '</div>';
        var b = this._host.querySelector("button");
        if (b) b.addEventListener("click", () => { this.removeAttribute("demo"); this.load(); });
        return;
      }

      var d3 = window.d3;
      var pad = 10, W = dim.W, H = dim.H;
      var proj = d3.geoMercator().fitExtent([[pad, pad], [W - pad, H - pad]], VIEW_BBOX);
      var path = d3.geoPath(proj);
      var provinces = (this._data.provinces || []).slice();
      var vals = provinces.map((p) => this.value(p)).filter((v) => v != null);
      var max = Math.max.apply(null, vals.concat([1]));
      var r = d3.scaleSqrt().domain([0, max]).range([2.6, 15]);

      this._host.innerHTML = '<div class="stage"></div><div class="legend"></div>';
      var stage = this._host.querySelector(".stage");
      var legend = this._host.querySelector(".legend");
      stage.style.width = W + "px";
      stage.style.height = H + "px";

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, style: "overflow:hidden", role: "group", "aria-label": "Bản đồ hoạt động sinh viên theo tỉnh, thành phố" });
      svg.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }));
      var gNear = el("g", { "aria-hidden": "true" });
      this._near.forEach((f) => {
        var d = path(f);
        if (d) gNear.appendChild(el("path", { d: d, fill: "var(--ink-100,#f0f2f6)", stroke: "var(--white,#fff)", "stroke-width": 1 }));
      });
      svg.appendChild(gNear);
      svg.appendChild(el("path", { d: path(this._vn), fill: "var(--blue-50,#f0f6fd)", stroke: "var(--blue-300,#79b4e9)", "stroke-width": 1.1, "stroke-linejoin": "round" }));

      /* Hoàng Sa & Trường Sa — vẽ từ payload, vị trí minh hoạ, không phải đơn vị cấp tỉnh. */
      (this._data.archipelagos || []).forEach(function (a) {
        var c = proj([a.lon, a.lat]);
        if (!c) return;
        var g = el("g", { class: "arch", role: "img", "aria-label": a.name + " — thuộc chủ quyền Việt Nam, " + (a.administered_by || "") + " (vị trí minh hoạ)" });
        (a.islet_offsets || [[0, 0]]).forEach(function (o) {
          var q = proj([a.lon + o[0], a.lat + o[1]]);
          if (!q) return;
          g.appendChild(el("circle", { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: 1.7, fill: "var(--blue-500,#1272c2)", "fill-opacity": 0.85 }));
        });
        g.appendChild(el("circle", {
          cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: 20, fill: "none",
          stroke: "var(--blue-300,#79b4e9)", "stroke-width": 1, "stroke-dasharray": "3 3", "stroke-opacity": 0.9
        }));
        g.appendChild(el("text", { x: c[0].toFixed(1), y: (c[1] + 33).toFixed(1), "text-anchor": "middle" }, a.name));
        if (a.administered_by) {
          g.appendChild(el("text", { class: "sub", x: c[0].toFixed(1), y: (c[1] + 44).toFixed(1), "text-anchor": "middle" }, a.administered_by));
        }
        svg.appendChild(g);
      });

      /* Khối ngoài nước — tính riêng, không thuộc 34 đơn vị trong nước. */
      var ov = (this._data.overseas && this._data.overseas.countries) || [];
      if (ov.length) {
        var gr = Math.max(46, Math.round(W * 0.11)), gcx = W - gr - 14, gcy = gr + 34;
        var gg = el("g", {
          class: "globe" + (this._ovSel ? " sel" : "") + (this._gOpen ? " open" : ""), tabindex: "0", role: "button",
          "aria-expanded": this._gOpen ? "true" : "false",
          "aria-label": "Hội Sinh viên Việt Nam ở ngoài nước — " + ov.length + " nước, tính riêng ngoài 34 tỉnh, thành. Chọn để mở danh sách."
        });
        gg.appendChild(el("circle", { class: "sphere", cx: gcx, cy: gcy, r: gr, fill: "var(--blue-500,#1272c2)", "fill-opacity": 0.08, stroke: "var(--blue-400,#3f92db)", "stroke-width": 1.1 }));
        [0.34, 0.68].forEach(function (f) {
          gg.appendChild(el("ellipse", { cx: gcx, cy: gcy, rx: gr * f, ry: gr, fill: "none", stroke: "var(--blue-300,#79b4e9)", "stroke-width": 0.9 }));
        });
        gg.appendChild(el("line", { x1: gcx, y1: gcy - gr, x2: gcx, y2: gcy + gr, stroke: "var(--blue-300,#79b4e9)", "stroke-width": 0.9 }));
        [-0.62, 0, 0.62].forEach(function (f) {
          var y = gcy + gr * f, hx = gr * Math.sqrt(Math.max(0, 1 - f * f));
          gg.appendChild(el("line", { x1: gcx - hx, y1: y, x2: gcx + hx, y2: y, stroke: "var(--blue-300,#79b4e9)", "stroke-width": 0.9 }));
        });
        gg.appendChild(el("text", { x: gcx, y: gcy + gr + 14, "text-anchor": "middle" }, "Ngoài nước · " + ov.length + " nước"));
        svg.appendChild(gg);
        this._globe = { gg: gg, cx: gcx, cy: gcy, r: gr, list: ov };
      } else this._globe = null;

      var tip = document.createElement("div");
      tip.className = "tip";
      stage.appendChild(tip);

      if (this._globe) {
        var self = this;
        var G = this._globe, gmax = Math.max.apply(null, G.list.map(function (c) { return c.activity_count || 0; }).concat([1]));
        var sorted = G.list.slice().sort(function (a, b3) { return (b3.activity_count || 0) - (a.activity_count || 0); });
        var gp = document.createElement("div");
        gp.className = "gpanel";
        gp.setAttribute("role", "group");
        gp.setAttribute("aria-label", "Hội Sinh viên Việt Nam ở ngoài nước");
        gp.innerHTML =
          '<div class="head"><div><h4>Hội Sinh viên Việt Nam ở ngoài nước</h4>' +
          '<p class="sub">' + G.list.length + ' nước · tính riêng ngoài 34 tỉnh, thành</p></div>' +
          '<button class="x" type="button" aria-label="Đóng danh sách">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><ol>' +
          sorted.map(function (c, i) {
            var v = c.activity_count || 0, f = v / gmax;
            return '<li><button type="button" data-i="' + i + '" aria-pressed="' + (self._ovSel === c.name ? "true" : "false") + '">' +
              '<span style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;line-height:1.25;color:var(--text-body,#1d232c)">' +
              c.name.replace("Hội Sinh viên Việt Nam tại ", "") +
              '<b style="font-family:var(--font-mono,monospace);font-weight:500;color:var(--text-muted,#647081)">' + v + '</b></span>' +
              '<div class="bar"><i style="width:' + Math.max(6, Math.round(f * 100)) + '%;opacity:' + (0.3 + 0.7 * f).toFixed(2) + '"></i></div>' +
              '</button></li>';
          }).join("") + '</ol>' +
          '<p class="hint">Bấm tên một Hội để xem số liệu chi tiết ở bảng bên cạnh.</p>';
        stage.appendChild(gp);

        /* Đặt bảng bên trái hoặc bên phải quả địa cầu — chọn phía còn chỗ trên màn hình. */
        var place = function () {
          gp.style.width = Math.min(290, Math.max(180, W - 16)) + "px";
          gp.style.maxHeight = Math.max(160, H - 16) + "px";
          var pw = gp.offsetWidth || 290, ph = gp.offsetHeight || 220, gap = 14;
          var sr = stage.getBoundingClientRect();
          var vw = window.innerWidth || sr.width;
          var rightX = G.cx + G.r + gap, leftX = G.cx - G.r - gap - pw;
          var fitsRight = rightX + pw <= W - 4 && sr.left + rightX + pw <= vw - 8;
          var fitsLeft = leftX >= 4 && sr.left + leftX >= 8;
          var x, y = Math.max(4, Math.min(G.cy - G.r, H - ph - 4));
          if (fitsLeft) x = leftX;
          else if (fitsRight) x = rightX;
          else { x = Math.max(4, Math.min(W - pw - 4, G.cx - pw / 2)); y = Math.max(4, Math.min(G.cy + G.r + 22, H - ph - 4)); }
          gp.style.left = Math.round(x) + "px";
          gp.style.top = Math.round(y) + "px";
        };
        var gshow = function (pin) {
          gp.classList.add("on");
          if (pin) { gp.classList.add("pinned"); self._gOpen = true; G.gg.classList.add("open"); G.gg.setAttribute("aria-expanded", "true"); }
          place();
        };
        var ghide = function (force) {
          if (gp.classList.contains("pinned") && !force) return;
          gp.classList.remove("on");
        };
        var gclose = function () {
          gp.classList.remove("pinned");
          gp.classList.remove("on");
          self._gOpen = false;
          G.gg.classList.remove("open");
          G.gg.setAttribute("aria-expanded", "false");
        };
        var gtoggle = function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          if (gp.classList.contains("pinned")) gclose(); else gshow(true);
        };
        G.gg.addEventListener("mouseenter", function () { gshow(false); });
        G.gg.addEventListener("focus", function () { gshow(false); });
        G.gg.addEventListener("mouseleave", function () { ghide(false); });
        G.gg.addEventListener("blur", function () { ghide(false); });
        G.gg.addEventListener("click", gtoggle);
        G.gg.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") gtoggle(e);
        });
        gp.querySelector(".x").addEventListener("click", function (e) { e.stopPropagation(); gclose(); G.gg.focus(); });
        gp.addEventListener("click", function (e) {
          var b = e.target.closest ? e.target.closest("button[data-i]") : null;
          if (!b) return;
          e.stopPropagation();
          self.selectOverseas(sorted[+b.getAttribute("data-i")]);
          Array.prototype.forEach.call(gp.querySelectorAll("button[data-i]"), function (o) {
            o.setAttribute("aria-pressed", o === b && self._ovSel ? "true" : "false");
          });
        });
        if (this._gOpen) gshow(true);

        if (this._gDoc) document.removeEventListener("click", this._gDoc, true);
        if (this._gKey) document.removeEventListener("keydown", this._gKey);
        this._gDoc = function (e) {
          if (!gp.classList.contains("pinned")) return;
          var p2 = e.composedPath ? e.composedPath() : [];
          if (p2.indexOf(gp) > -1 || p2.indexOf(G.gg) > -1) return;
          gclose();
        };
        this._gKey = function (e) { if (e.key === "Escape" && gp.classList.contains("pinned")) { gclose(); G.gg.focus(); } };
        document.addEventListener("click", this._gDoc, true);
        document.addEventListener("keydown", this._gKey);
        this._gReplace = place;
      } else if (this._gDoc) {
        document.removeEventListener("click", this._gDoc, true);
        document.removeEventListener("keydown", this._gKey);
        this._gDoc = this._gKey = null;
      }

      /* Vẽ đơn vị: giá trị lớn vẽ trước để điểm nhỏ không bị che. */
      var order = provinces.map((p, i) => i).sort((a, b2) => {
        var va = this.value(provinces[a]), vb = this.value(provinces[b2]);
        return (vb == null ? -1 : vb) - (va == null ? -1 : va);
      });
      order.forEach((i) => {
        var p = provinces[i], v = this.value(p), xy = proj([p.lon, p.lat]);
        if (!xy) return;
        var sel = this._selected === p.slug;
        var none = v == null;
        var rad = none ? 4.6 : r(v);
        var label = none
          ? p.province_name + ": chưa có số liệu" + (p.reported === false ? " — đơn vị chưa báo cáo kỳ này" : " cho chuyên mục đang chọn")
          : p.province_name + ": " + v + " hoạt động" + (p.article_count != null ? ", " + p.article_count + " tin bài" : "");
        var g = el("g", {
          class: "p", id: "province-" + p.slug, transform: "translate(" + xy[0].toFixed(1) + "," + xy[1].toFixed(1) + ")",
          tabindex: "0", role: "button", "aria-label": label, "aria-pressed": sel ? "true" : "false"
        });
        g.appendChild(el("circle", { class: "ring", r: rad + 5.5, fill: "none", stroke: "var(--blue-700,#0a4c8a)", "stroke-width": sel ? 1.8 : 0, opacity: sel ? 1 : 0 }));
        if (none) {
          g.appendChild(el("circle", {
            class: "dot", r: rad, fill: "var(--white,#fff)", "fill-opacity": 0.9,
            stroke: "var(--ink-400,#8d97a5)", "stroke-width": 1.3, "stroke-dasharray": "2.6 2.2"
          }));
        } else {
          g.appendChild(el("circle", {
            class: "dot", r: rad, fill: sel ? "var(--blue-700,#0a4c8a)" : "var(--blue-500,#1272c2)",
            "fill-opacity": sel ? 1 : 0.32 + 0.5 * (v / max), stroke: "var(--white,#fff)", "stroke-width": 1
          }));
        }
        g.appendChild(el("circle", { class: "hit", r: Math.max(rad + 9, 16) }));

        var show = () => {
          tip.innerHTML =
            '<h4>' + p.province_name + '</h4>' +
            (none
              ? '<div class="none">' + (p.reported === false
                ? "Đơn vị chưa báo cáo trong kỳ này." : "Chưa có dữ liệu cho chuyên mục đang chọn.") + '</div>'
              : '<div class="n"><div><b>' + nfm(v) + '</b><span>hoạt động</span></div>' +
                (p.article_count != null ? '<div><b>' + nfm(p.article_count) + '</b><span>tin bài</span></div>' : "") + '</div>' +
                (p.latest_article ? '<p><em>Tin mới nhất</em>' + p.latest_article.title + '</p>' : ""));
          tip.classList.add("on");
          /* Đặt cạnh điểm, không nằm trên điểm đang chọn. */
          var tw = tip.offsetWidth || 232, th = tip.offsetHeight || 150;
          var x = xy[0] + rad + 16;
          if (x + tw > W - 4) x = xy[0] - rad - 16 - tw;
          if (x < 4) x = Math.min(Math.max(4, xy[0] + rad + 16), Math.max(W - tw - 4, 4));
          tip.style.left = Math.round(x) + "px";
          tip.style.top = Math.round(Math.max(4, Math.min(xy[1] - th / 2, H - th - 4))) + "px";
        };
        var hide = () => tip.classList.remove("on");
        g.addEventListener("mouseenter", show);
        g.addEventListener("focus", show);
        g.addEventListener("mouseleave", hide);
        g.addEventListener("blur", hide);
        var pick = () => this.select(p.slug);
        g.addEventListener("click", pick);
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
        });
        svg.appendChild(g);
      });
      stage.insertBefore(svg, tip);

      var hasNone = provinces.some((p) => this.value(p) == null);
      legend.innerHTML =
        '<div class="sizes"><span class="lbl" style="align-self:center">Mức hoạt động</span>' +
        [0.15, 0.5, 1].map((f) => {
          var s = Math.round(r(max * f) * 2);
          return '<div><b style="width:' + s + 'px;height:' + s + 'px"></b>' + Math.round(max * f) + '</div>';
        }).join("") + '</div>' +
        (hasNone ? '<span class="none"><i></i>Chưa có dữ liệu</span>' : "");
    }

    setSelected(slug) {
      if (this._selected === slug) return;
      if (slug) this.clearOverseas(true);
      this._selected = slug;
      this.emit();
      if (reduced()) this.paint(); else requestAnimationFrame(() => this.paint());
    }
    select(slug) {
      this.clearOverseas(true);
      this._selected = this._selected === slug ? null : slug;
      this.emit();
      if (reduced()) this.paint(); else requestAnimationFrame(() => this.paint());
    }
    /* Khối ngoài nước: chọn một Hội để trang ngoài mở bảng chi tiết như khi chọn tỉnh, thành. */
    clearOverseas(notify) {
      if (!this._ovSel) return;
      this._ovSel = null;
      if (this._globe && this._globe.gg) this._globe.gg.classList.remove("sel");
      if (notify) this.dispatchEvent(new CustomEvent("overseas-select", { detail: null, bubbles: true, composed: true }));
    }
    selectOverseas(c) {
      if (!c) return;
      var on = this._ovSel !== c.name;
      this._ovSel = on ? c.name : null;
      if (this._globe && this._globe.gg) this._globe.gg.classList.toggle("sel", on);
      var needPaint = false;
      if (on && this._selected) { this._selected = null; this.emit(); needPaint = true; }
      this.dispatchEvent(new CustomEvent("overseas-select", {
        detail: on ? { name: c.name, country: c, label: (this._data.overseas && this._data.overseas.label) || "" } : null,
        bubbles: true, composed: true
      }));
      if (needPaint) { if (reduced()) this.paint(); else requestAnimationFrame(() => this.paint()); }
    }
    emit() {
      var p = ((this._data && this._data.provinces) || []).find((x) => x.slug === this._selected) || null;
      this.dispatchEvent(new CustomEvent("province-select", {
        detail: p ? { slug: p.slug, province: p, value: this.value(p), filter: this._filter } : null,
        bubbles: true, composed: true
      }));
    }
  }
  if (!customElements.get("vietnam-activity-map")) customElements.define("vietnam-activity-map", VietnamActivityMap);
})();

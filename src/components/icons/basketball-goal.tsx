import { bsIconPropsToDataStore } from './icons'
import type { BsIconProps } from './icons.d'

export default function BsIconBasketballGoal(props: BsIconProps) {
  const data = bsIconPropsToDataStore(props)

  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 512 512"
      width={data.width}
      height={data.height}
      fill={data.fill}
    >
      <g>
        <path
          d="M436.739,207.954h-54.666c3.214-5.99,5.943-12.167,8.223-18.512c1.981-5.69,3.616-11.465,4.877-17.324
		c0.804-3.692,1.439-7.485,1.982-11.372c2.346-17.68,1.271-36.164-3.513-54.48c-2.616-10.017-6.318-19.577-10.83-28.51
		c-2.252-4.421-4.682-8.747-7.402-12.812c-2.065-3.243-4.326-6.402-6.578-9.382c-16.96-22.006-39.874-38.425-65.767-47.536
		c-8.569-2.981-17.41-5.232-26.426-6.494c-3.523-0.542-7.13-0.906-10.653-1.177c-15.148-1.075-30.669,0.271-46.004,4.336
		c-8.298,2.168-16.147,4.953-23.633,8.485c-3.794,1.701-7.494,3.598-11.101,5.682c-5.588,3.149-11.008,6.765-16.054,10.634
		c-19.035,14.708-33.921,33.92-43.48,55.572c-1.449,3.337-2.794,6.766-4.065,10.196c-1.345,4.065-2.616,8.297-3.7,12.446
		c-5.682,22.559-5.859,46.723,0.364,70.636c2.784,10.466,6.69,20.39,11.53,29.613h-54.59c-8.803,0-15.924,7.12-15.924,15.932
		c0,8.803,7.12,15.933,15.924,15.933h7.494c7.008,16.914,22.66,57.553,36.35,111.976c1.055,4.102,2.112,8.288,3.158,12.475
		c0.673,2.944,1.346,5.888,2.018,8.915c0.757,3.205,1.43,6.494,2.196,9.793c8.326,38.856,14.924,82.869,16.746,129.021l28.706-0.981
		c-0.196-5.794-0.57-11.4-0.962-17.026c-0.094-0.084-0.094-0.084,0-0.084c-0.112-1.804-0.318-3.514-0.449-5.308
		c8.214-23.053,19.296-44.742,32.473-64.89c0.01,0.01,0.028,0.029,0.047,0.038c14.914,14.754,29.202,30.678,42.2,48.003
		c-8.55,11.98-16.418,24.576-23.539,37.686h16.605c4.953-8.644,10.148-17.119,15.82-25.249c5.672,8.13,10.868,16.605,15.821,25.249
		h16.558c-7.102-13.11-14.951-25.707-23.501-37.686c12.998-17.325,27.286-33.249,42.116-48.003c0.019-0.029,0.037-0.038,0.056-0.056
		c13.167,20.118,24.24,41.789,32.454,64.814c-0.122,1.766-0.327,3.448-0.439,5.224c-0.392,5.7-0.767,11.494-0.963,17.288
		L364.926,512c1.916-46.152,8.513-89.998,16.746-128.834v-0.093c0.766-3.392,1.533-6.682,2.196-9.887
		c0.672-3.028,1.439-5.971,2.112-8.915c0.953-4.279,2.01-8.373,3.056-12.475c3.355-13.624,6.897-26.38,10.438-38.042
		c7.653-25.576,15.11-46.331,20.66-60.684c2.066-5.364,3.86-9.793,5.28-13.25h11.326c8.793,0,15.932-7.13,15.932-15.933
		C452.671,215.075,445.532,207.954,436.739,207.954z M371.981,111.948c2.897,10.914,4.149,21.828,3.888,32.566
		c-5.055-4.149-10.288-8.484-16.148-12.447c-6.224-4.232-13.082-8.12-20.932-10.55c-7.756-2.533-16.418-3.345-24.81-1.99
		c-5.233,0.812-10.373,2.346-15.148,4.326c-6.317-13.438-13.718-26.062-21.932-37.799c2.532-0.99,4.962-1.981,7.4-2.887
		c15.428-5.504,31.128-8.924,46.556-10.008c7.746-0.636,15.512-0.543,23.09,0C362.066,84.522,368.196,97.604,371.981,111.948z
		 M252.463,207.954c1.43-6.382,3-12.755,5.046-19.063c4.514-13.802,11.279-27.062,21.558-37.434
		c4.149-4.326,8.85-8.027,13.895-11.092c9.382,22.436,15.475,45.368,19.455,67.59H252.463z M254.117,252.818
		c11.896,7.326,27.371,19.1,44.406,34.528c2.831,2.542,5.746,5.261,8.756,8.074c-9.924,7.578-20.026,15.698-30.108,24.399
		c-7.738,6.69-15.456,13.755-23.081,21.11c-7.626-7.354-15.344-14.419-23.1-21.11c-10.091-8.718-20.221-16.858-30.164-24.454
		c3.028-2.813,5.962-5.467,8.793-8.018C226.738,271.919,242.222,260.144,254.117,252.818z M246.23,185.285
		c-2.402,7.644-4.233,15.185-5.71,22.67h-80.644c4.868-9.27,10.083-18.54,15.811-27.81c8.298-13.353,17.68-26.613,28.324-39.247
		c10.653-12.616,22.652-24.53,36.266-34.724c6.766-5.047,13.896-9.466,21.194-13.167c1.449-0.72,2.896-1.449,4.429-2.168
		c8.298,11.915,15.783,24.716,22.193,38.426c-6.316,3.802-12.363,8.4-17.595,13.718c-5.953,6.046-10.915,12.895-14.877,20.109
		C251.64,170.314,248.669,177.809,246.23,185.285z M303.606,134.768c4.056-1.702,8.12-2.888,12.186-3.514
		c6.579-1.084,13.25-0.542,19.568,1.448c6.316,1.898,12.269,5.131,17.96,8.925c7.476,4.971,14.428,10.82,21.559,16.502
		c0,0.448-0.094,0.916-0.188,1.364c-2.504,17.363-8.989,33.922-18.483,48.462h-32.108
		C320.342,184.013,313.969,159.1,303.606,134.768z M269.415,38.07c2.439-4.598,4.149-9.475,5.232-14.26
		c22.549,3.606,43.575,13.53,60.535,28.51c3.243,2.794,6.317,5.86,9.288,9.018c-4.784-0.093-9.559,0-14.428,0.364
		c-16.512,0.99-33.295,4.514-49.713,10.279c-3.607,1.355-7.13,2.71-10.643,4.149c-5.233-6.765-10.728-13.166-16.418-19.212
		c2.355-1.804,4.69-3.7,6.765-5.868C263.817,47.172,266.985,42.751,269.415,38.07z M225.663,26.342
		c12.634-3.336,25.342-4.514,37.705-3.7c-0.981,3.514-2.345,6.85-4.055,10.008c-3.336,6.224-8.308,11.634-14.522,15.886
		c-8.036-7.681-16.334-14.446-24.81-20.576C221.785,27.416,223.682,26.875,225.663,26.342z M165.942,63.15
		c11.279-12.914,25.446-23.38,41.77-30.594c9.112,6.317,18.045,13.624,26.614,21.745c-6.13,2.794-12.896,4.869-19.848,6.401
		c-17.774,3.98-36.173,4.784-53.769,8.849C162.334,67.384,164.138,65.216,165.942,63.15z M137.263,125.217
		c2.168-14.53,6.934-28.51,13.98-41.144c2.336-0.813,4.681-1.532,7.214-2.074c8.746-2.252,18.128-3.523,27.968-4.784
		c9.831-1.261,20.11-2.439,30.669-4.784c9.018-2.065,17.951-4.962,26.165-9.195c5.316,5.597,10.465,11.54,15.334,17.857
		c-0.822,0.365-1.626,0.812-2.439,1.177c-8.026,4.056-15.783,8.934-22.997,14.345c-14.624,10.82-27.156,23.454-38.256,36.621
		c-10.999,13.176-20.568,26.978-29.044,40.874c-5.326,8.83-10.194,17.68-14.708,26.426c-4.784-8.569-8.569-17.858-11.185-27.791
		C135.815,156.69,135.095,140.636,137.263,125.217z M117.219,239.82h131.619c-13.606,7.924-30.52,20.736-49.377,37.715
		c-3.308,2.99-6.691,6.055-10.073,9.288C161.624,266.499,136.029,250.818,117.219,239.82z M124.648,270.358v-0.084
		c-1.58-4.466-3.084-8.616-4.504-12.549c16.764,10.073,37.219,23.09,59.067,39.004c-9.7,9.551-19.587,19.961-29.566,31.192
		c-1.823,2.094-3.654,4.336-5.494,6.467C137.59,309.624,130.721,287.926,124.648,270.358z M167.67,457.661
		c-2.317-20.063-5.252-39.415-8.672-57.833c-1.177-6.224-2.402-12.288-3.682-18.288c2.598,2.074,5.196,4.074,7.794,6.233
		c4.028,3.326,8.149,6.738,12.176,10.232c5.746,5.01,11.503,10.204,17.26,15.55C183.22,427.506,174.922,442.261,167.67,457.661z
		 M200.638,401.92c-5.121-4.784-10.251-9.466-15.475-13.895c-8.784-7.672-17.662-14.821-26.361-21.559
		c-2.757-2.186-5.485-4.139-8.224-6.177c-0.43-1.804-0.812-3.681-1.243-5.457c-0.298-1.261-0.616-2.42-0.916-3.654
		c0.131-0.168,0.272-0.337,0.402-0.496c1.654-2.037,3.392-4.008,5.037-5.962c12.457-14.41,24.801-27.706,36.799-39.472
		c10.018,7.625,20.212,15.783,30.37,24.566c7.738,6.672,15.438,13.718,23.016,21.045C228.672,366.514,213.935,383.54,200.638,401.92
		z M254.117,459.81c-13.372-17.222-27.93-33.248-42.938-47.91c-0.028-0.028-0.056-0.047-0.075-0.066
		c13.055-18.324,27.66-35.331,42.986-50.994c15.306,15.653,29.912,32.65,42.958,50.976
		C282.029,426.562,267.48,442.504,254.117,459.81z M349.142,399.911c-3.42,18.4-6.345,37.734-8.662,57.703
		c-7.242-15.372-15.521-30.099-24.828-44.023c5.765-5.373,11.531-10.559,17.296-15.587c4.028-3.494,8.055-6.906,12.083-10.148
		c2.598-2.149,5.196-4.168,7.784-6.233C351.562,387.624,350.311,393.642,349.142,399.911z M358.805,354.917
		c-0.43,1.729-0.804,3.598-1.234,5.364c-2.747,2.047-5.476,4.046-8.242,6.186c-8.69,6.812-17.568,13.971-26.36,21.559
		c-5.224,4.438-10.345,9.12-15.475,13.811c-0.01,0-0.01,0.01-0.01,0.01c-13.288-18.353-28.006-35.35-43.36-50.984
		c7.588-7.327,15.269-14.372,23.007-21.045c10.167-8.774,20.353-16.932,30.361-24.558c11.895,11.774,24.342,25.063,36.789,39.547
		c1.832,2.102,3.626,4.298,5.439,6.466C359.422,352.506,359.104,353.674,358.805,354.917z M383.484,270.274v0.084
		c-6.055,17.634-12.914,39.285-19.465,64.094c-1.831-2.112-3.645-4.298-5.532-6.364c-9.878-11.232-19.849-21.716-29.548-31.342
		c21.848-15.924,42.303-28.931,59.076-39.023C386.568,261.658,385.063,265.817,383.484,270.274z M318.716,286.879
		c-3.383-3.224-6.747-6.373-10.036-9.344c-18.857-16.979-35.771-29.791-49.377-37.715H390.95
		C372.121,250.828,346.498,266.536,318.716,286.879z"
        />
      </g>
    </svg>
  )
}

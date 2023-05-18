// SPDX-License-Identifier: MIT
// contract by steviep.eth



import "./Dependencies.sol";
import "hardhat/console.sol";

pragma solidity ^0.8.17;


interface IURI {
  function tokenURI(uint256 tokenId) external view returns (string memory);
}

contract MoneyMakingOpportunity is ERC721, Ownable {
  uint256 constant public FAIR_PRICE = 0.03 ether;

  uint256 public totalSupply;

  bool public isLocked = true;
  uint256 public beginning;
  uint256 public ending;
  address public uriContract;
  uint256 public contributors;


  mapping(address => uint256) public addrToTokenId;
  mapping(uint256 => mapping(uint256 => bool)) private _tokenVotes;
  mapping(uint256 => address) public settlementAddressProposals;
  mapping(address => uint256) public amountPaid;

  /// @dev This event emits when the metadata of a token is changed.
  /// So that the third-party platforms such as NFT market could
  /// timely update the images and related attributes of the NFT.
  event MetadataUpdate(uint256 _tokenId);

  /// @dev This event emits when the metadata of a range of tokens is changed.
  /// So that the third-party platforms such as NFT market could
  /// timely update the images and related attributes of the NFTs.
  event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

  constructor() ERC721('Money Making Opportunity', 'MMO') {
    contributors++;
  }

  receive() external payable {
    uint256 originalAmount = amountPaid[msg.sender];
    amountPaid[msg.sender] += msg.value;

    if (
      isLocked
      && originalAmount < FAIR_PRICE
      && amountPaid[msg.sender] >= FAIR_PRICE
    ) {
      addrToTokenId[msg.sender] = contributors;
      contributors++;

    } else if (ending > 0) {
      payable(settlementAddressProposals[leaderToken()]) .send(address(this).balance);
    }
  }

  function unlock(address _uriContract) external onlyOwner {
    require(isLocked, '1');
    isLocked = false;
    beginning = block.timestamp;
    totalSupply++;
    setUriContract(_uriContract);
    _mint(msg.sender, 0);
  }

  function claim() external {
    require(!isLocked, '2');

    totalSupply++;
    _mint(msg.sender, addrToTokenId[msg.sender]);
  }

  function castVote(uint256 tokenId, uint256 period, bool vote) external {
    require(ownerOf(tokenId) == msg.sender, '4');
    require(period >= currentPeriod(), '5');
    require(ending == 0, '9');

    _tokenVotes[tokenId][period] = vote;
    emit MetadataUpdate(tokenId);
  }

  // function castVotes(uint256[] calldata tokenIds, uint256 period, bool vote) external {
  //   require(period >= currentPeriod(), '5');
  //   require(ending == 0, '9');

  //   uint len = tokenIds.length;

  //   for (uint256 i; i < len; i++) {
  //     uint256 tokenId = tokenIds[i];
  //     require(ownerOf(tokenId) == msg.sender, '4');
  //     _tokenVotes[tokenId][period] = vote;
  //   }

    // emit BatchMetadataUpdate(0, contributors);
  // }


  function commitSettlementAddressProposal(uint256 tokenId, address settlementAddress) external {
    require(!isEliminated(tokenId), '6');
    require(ownerOf(tokenId) == msg.sender, '4');
    require(settlementAddressProposals[tokenId] == address(0), '7');
    settlementAddressProposals[tokenId] = settlementAddress;
    emit MetadataUpdate(tokenId);
  }


  function settlePayment() external {
    require(ending == 0, '8');

    (uint256 yays, uint256 nays) = calculateVotes(currentPeriod());

    require(yays >= nays, '10');

    ending = block.timestamp;
    payable(settlementAddressProposals[leaderToken()]).send(address(this).balance);
  }

  function calculateVotes(uint256 period) public view returns (uint256, uint256) {
    uint256 yays = 1;
    uint256 nays;
    uint256 tokenId = periodToTokenId(period);

    for (uint256 i = 0; i < tokenId; i++) {
      if (_tokenVotes[i][period]) yays++;
      else nays++;
    }

    return (yays, nays);
  }

  function tokenIdToPeriod(uint256 tokenId) public view returns (uint256) {
    return contributors - tokenId;
  }

  function periodToTokenId(uint256 period) public view returns (uint256) {
    if (isLocked) return 0;
    return contributors - period;
  }


  function currentPeriod() public view returns (uint256) {
    if (isLocked) return 0;
    uint256 endTime = ending > 0 ? ending : block.timestamp;
    uint256 period = 1 + (endTime - beginning) / 1 weeks;

    return period >= contributors ? contributors : period;
  }

  function leaderToken() public view returns (uint256) {
    return periodToTokenId(currentPeriod());
  }

  function isEliminated (uint256 tokenId) public view returns (bool) {
    return tokenId > leaderToken();
  }

  function votes(uint256 tokenId, uint256 period) public view returns (bool) {
    return _tokenVotes[tokenId][period];
  }



  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return IURI(uriContract).tokenURI(tokenId);
  }

  function exists(uint256 tokenId) external view returns (bool) {
    return _exists(tokenId);
  }

  function setUriContract(address _uriContract) public onlyOwner {
    uriContract = _uriContract;
    emit BatchMetadataUpdate(0, contributors);
  }


  /// @notice Query if a contract implements an interface
  /// @param interfaceId The interface identifier, as specified in ERC-165
  /// @return `true` if the contract implements `interfaceId` and
  ///         `interfaceId` is not 0xffffffff, `false` otherwise
  /// @dev Interface identification is specified in ERC-165. This function
  ///      uses less than 30,000 gas. See: https://eips.ethereum.org/EIPS/eip-165
  ///      See EIP-4906: https://eips.ethereum.org/EIPS/eip-4906
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721) returns (bool) {
    return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
  }
}
